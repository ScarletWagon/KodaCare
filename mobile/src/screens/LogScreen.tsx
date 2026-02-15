import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api, ConditionCard, ConditionLogRecord } from "../services/api";

/* ── helpers ──────────────────────────────────────────── */
function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function painColor(level: number): string {
  if (level <= 3) return "#22c55e";
  if (level <= 6) return "#eab308";
  return "#ef4444";
}

/* ════════════════════════════════════════════════════════ */

export default function LogScreen() {
  const { token } = useAuth();
  const [conditions, setConditions] = useState<ConditionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* Detail modal state */
  const [detail, setDetail] = useState<{
    condition: ConditionCard;
    logs: ConditionLogRecord[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchConditions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getMyConditions(token);
      // Sort by most recent last_reported
      const sorted = res.conditions.sort(
        (a, b) => new Date(b.last_reported).getTime() - new Date(a.last_reported).getTime(),
      );
      setConditions(sorted);
    } catch (e) {
      console.error("Failed to fetch conditions", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchConditions();
    }, [fetchConditions]),
  );

  const openDetail = async (card: ConditionCard) => {
    if (!token) return;
    setDetailLoading(true);
    setDetail({ condition: card, logs: [] });
    try {
      const res = await api.getConditionDetail(token, card.id);
      setDetail({ condition: res.condition, logs: res.logs });
    } catch (e) {
      console.error("Failed to load detail", e);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ── Summary stats (computed from logs in detail modal) ── */
  const computeStats = (logs: ConditionLogRecord[]) => {
    if (!logs.length) return null;
    const painLevels = logs.filter((l) => l.pain_level > 0).map((l) => l.pain_level);
    const avgPain = painLevels.length
      ? (painLevels.reduce((a, b) => a + b, 0) / painLevels.length).toFixed(1)
      : null;
    const allLocations = logs.flatMap((l) => l.location);
    const locationCounts: Record<string, number> = {};
    allLocations.forEach((loc) => { locationCounts[loc] = (locationCounts[loc] || 0) + 1; });
    const topLocations = Object.entries(locationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([loc]) => loc);

    const dates = logs.map((l) => formatDate(l.created_at));
    return { avgPain, topLocations, dates, total: logs.length };
  };

  /* ── render ─────────────────────────────────────────── */
  if (loading) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator size="large" color="#db2777" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConditions(); }} tintColor="#db2777" />
        }
      >
        <Text style={styles.heading}>📋 Health Horizon</Text>
        <Text style={styles.subtitle}>
          Your tracked conditions — tap one for a doctor-ready summary
        </Text>

        {conditions.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🐻</Text>
            <Text style={styles.emptyText}>No conditions logged yet.</Text>
            <Text style={styles.emptyHint}>
              Use the Record tab to tell Barnaby about your symptoms!
            </Text>
          </View>
        )}

        {conditions.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => openDetail(card)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{card.condition_name}</Text>
              <View style={[styles.statusBadge, card.status === "resolved" && styles.statusResolved]}>
                <Text style={[styles.statusText, card.status === "resolved" && styles.statusTextResolved]}>
                  {card.status === "active" ? "Active" : "Resolved"}
                </Text>
              </View>
            </View>

            <View style={styles.cardMeta}>
              <Text style={styles.metaItem}>
                📝 {card.log_count} log{card.log_count !== 1 ? "s" : ""}
              </Text>
              <Text style={styles.metaItem}>
                🕐 Last: {relativeTime(card.last_reported)}
              </Text>
            </View>

            <Text style={styles.metaDates}>
              First reported: {formatDate(card.first_reported)}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Condition Detail Modal ──────────────────── */}
      <Modal visible={detail !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {detail && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{detail.condition.condition_name}</Text>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.statusBadge, detail.condition.status === "resolved" && styles.statusResolved, { alignSelf: "flex-start", marginBottom: 16 }]}>
                  <Text style={[styles.statusText, detail.condition.status === "resolved" && styles.statusTextResolved]}>
                    {detail.condition.status === "active" ? "🟢 Active" : "✅ Resolved"}
                  </Text>
                </View>

                {detailLoading ? (
                  <ActivityIndicator color="#db2777" style={{ marginVertical: 30 }} />
                ) : (
                  <>
                    {/* Doctor-ready summary */}
                    {(() => {
                      const stats = computeStats(detail.logs);
                      if (!stats) return null;
                      return (
                        <View style={styles.summaryBox}>
                          <Text style={styles.summaryTitle}>📊 Doctor Visit Summary</Text>

                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Total episodes:</Text>
                            <Text style={styles.statValue}>{stats.total}</Text>
                          </View>

                          {stats.avgPain && (
                            <View style={styles.statRow}>
                              <Text style={styles.statLabel}>Avg pain level:</Text>
                              <Text style={[styles.statValue, { color: painColor(parseFloat(stats.avgPain)) }]}>
                                {stats.avgPain} / 10
                              </Text>
                            </View>
                          )}

                          {stats.topLocations.length > 0 && (
                            <View style={styles.statRow}>
                              <Text style={styles.statLabel}>Common areas:</Text>
                              <Text style={styles.statValue}>{stats.topLocations.join(", ")}</Text>
                            </View>
                          )}

                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>First reported:</Text>
                            <Text style={styles.statValue}>{formatDate(detail.condition.first_reported)}</Text>
                          </View>
                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Last reported:</Text>
                            <Text style={styles.statValue}>{formatDate(detail.condition.last_reported)}</Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Individual log entries */}
                    <Text style={styles.logsHeading}>🗂️ Log History</Text>
                    {detail.logs.map((log) => (
                      <View key={log.id} style={styles.logEntry}>
                        <View style={styles.logHeader}>
                          <Text style={styles.logDate}>{formatDate(log.created_at)}</Text>
                          {log.pain_level > 0 && (
                            <View style={[styles.painBadge, { backgroundColor: painColor(log.pain_level) + "20", borderColor: painColor(log.pain_level) }]}>
                              <Text style={[styles.painText, { color: painColor(log.pain_level) }]}>
                                Pain: {log.pain_level}/10
                              </Text>
                            </View>
                          )}
                        </View>

                        {log.location.length > 0 && (
                          <Text style={styles.logLocation}>📍 {log.location.join(", ")}</Text>
                        )}

                        {log.details ? (
                          <Text style={styles.logDetails}>{log.details}</Text>
                        ) : null}

                        {log.mascot_notes.length > 0 && (
                          <View style={styles.notesBox}>
                            {log.mascot_notes.map((note, i) => (
                              <Text key={i} style={styles.noteItem}>• {note}</Text>
                            ))}
                          </View>
                        )}

                        <Text style={styles.logMode}>via {log.input_mode}</Text>
                      </View>
                    ))}
                  </>
                )}

                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetail(null)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ── styles ───────────────────────────────────────────── */
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fce7f3" },
  center: { alignItems: "center", justifyContent: "center" },
  scroll: { padding: 24, paddingTop: 60 },

  heading: {
    fontSize: 26, fontWeight: "700", color: "#9d174d",
    textAlign: "center", marginBottom: 4,
    textShadowColor: "#fff", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 14, color: "#9d174d", textAlign: "center",
    marginBottom: 24, fontWeight: "500",
  },

  /* Empty state */
  emptyBox: {
    backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 20,
    padding: 40, alignItems: "center", marginTop: 20,
    borderWidth: 1, borderColor: "rgba(219,39,119,0.1)",
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#9d174d", marginBottom: 6 },
  emptyHint: { fontSize: 14, color: "#b4637a", textAlign: "center", lineHeight: 20 },

  /* Condition card */
  card: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1, borderColor: "rgba(219,39,119,0.15)",
    borderRadius: 16, padding: 18, marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  cardName: { fontSize: 18, fontWeight: "700", color: "#db2777", flex: 1 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  statusResolved: { backgroundColor: "rgba(156,163,175,0.15)" },
  statusText: { fontSize: 11, fontWeight: "700", color: "#22c55e" },
  statusTextResolved: { color: "#6b7280" },
  cardMeta: { flexDirection: "row", gap: 16, marginBottom: 6 },
  metaItem: { fontSize: 13, color: "#9d174d", fontWeight: "500" },
  metaDates: { fontSize: 12, color: "#b4637a" },

  /* Modal */
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fdf2f8", borderTopLeftRadius: 24,
    borderTopRightRadius: 24, maxHeight: "88%",
    padding: 24, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: "#9d174d", flex: 1 },
  modalClose: { fontSize: 22, color: "#9d174d", padding: 4 },

  /* Summary box */
  summaryBox: {
    backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 16,
    padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(219,39,119,0.12)",
  },
  summaryTitle: { fontSize: 16, fontWeight: "700", color: "#db2777", marginBottom: 14 },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  statLabel: { fontSize: 14, color: "#9d174d", fontWeight: "500" },
  statValue: { fontSize: 14, color: "#1f2937", fontWeight: "600" },

  /* Logs */
  logsHeading: { fontSize: 16, fontWeight: "700", color: "#9d174d", marginBottom: 12 },
  logEntry: {
    backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(219,39,119,0.1)",
  },
  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  logDate: { fontSize: 13, fontWeight: "600", color: "#9d174d" },
  painBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    borderWidth: 1,
  },
  painText: { fontSize: 11, fontWeight: "700" },
  logLocation: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  logDetails: { fontSize: 14, color: "#1f2937", lineHeight: 20, marginBottom: 6 },
  notesBox: {
    backgroundColor: "rgba(219,39,119,0.05)", borderRadius: 10,
    padding: 10, marginBottom: 6,
  },
  noteItem: { fontSize: 13, color: "#6b7280", lineHeight: 18 },
  logMode: { fontSize: 11, color: "#b4637a", textAlign: "right" },

  closeBtn: {
    backgroundColor: "#db2777", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 16,
  },
  closeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});