/**
 * Receiver — Inbox & Message List with search + filters.
 */
import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl } from 'react-native'
import {
  Card,
  Empty,
  Input,
  Muted,
  Row,
  Screen,
  StatusPill,
  Title,
} from '@/components/ui'
import { colors } from '@/constants/theme'
import { useMessageStore } from '@/stores/message-store'
import { useDeviceStore } from '@/stores/device-store'
import { router } from 'expo-router'

const FILTERS = ['all', 'delivered', 'sent'] as const

export default function Inbox() {
  const inbox = useMessageStore((s) => s.inbox)
  const syncAll = useMessageStore((s) => s.syncAll)
  const vaultError = useMessageStore((s) => s.vaultError)
  const device = useDeviceStore((s) => s.device)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [refreshing, setRefreshing] = useState(false)

  const filtered = useMemo(
    () =>
      inbox.filter((m) => {
        if (filter !== 'all' && m.status !== filter) return false
        if (!query.trim()) return true
        const hay =
          `${m.decrypted ?? ''} ${m.senderDeviceId} ${m.sim?.displayName ?? ''}`.toLowerCase()
        return hay.includes(query.toLowerCase())
      }),
    [inbox, query, filter],
  )

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.messageId}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void syncAll().finally(() => setRefreshing(false))
            }}
            tintColor={colors.accentSoft}
          />
        }
        ListHeaderComponent={
          <Card style={{ marginBottom: 6, gap: 12 }}>
            {vaultError ? (
              <Card style={{ borderColor: colors.red, gap: 4 }}>
                <Title style={{ fontSize: 14, color: colors.red }}>
                  Local vault unavailable
                </Title>
                <Muted style={{ fontSize: 12 }}>{vaultError}</Muted>
              </Card>
            ) : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <Title>Inbox</Title>
              <Muted>{inbox.length} messages</Muted>
            </Row>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search messages…"
            />
            <Row>
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === f }}
                >
                  <Muted
                    style={{
                      color:
                        filter === f ? colors.accentSoft : colors.textFaint,
                      fontWeight: filter === f ? '700' : '400',
                      textTransform: 'capitalize',
                    }}
                  >
                    {f}
                  </Muted>
                </Pressable>
              ))}
            </Row>
          </Card>
        }
        renderItem={({ item }) => {
          const title = item.fromName ?? item.from ?? item.sim?.displayName
          return (
            <Pressable
              onPress={() =>
                router.push(`/(receiver)/message/${item.messageId}`)
              }
              accessibilityRole="button"
              accessibilityLabel={`${title ?? item.senderDeviceId.slice(0, 14)}, ${item.status}`}
            >
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Title
                    numberOfLines={1}
                    style={{ fontSize: 14, flexShrink: 1 }}
                  >
                    {title ?? item.senderDeviceId.slice(0, 14)}
                  </Title>
                  <StatusPill status={item.status} />
                </Row>
                <Muted numberOfLines={1}>
                  {item.decrypted ??
                    'Tap to decrypt locally (key never leaves this device)'}
                </Muted>
                {item.sim?.displayName ? (
                  <Muted
                    numberOfLines={1}
                    style={{ fontSize: 11 }}
                  >
                    {item.sim.displayName}
                    {item.sim.carrierName ? ` · ${item.sim.carrierName}` : ''}
                  </Muted>
                ) : null}
                <Row style={{ justifyContent: 'flex-end' }}>
                  <Muted style={{ fontSize: 11 }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Muted>
                </Row>
              </Card>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <Empty
            icon="📥"
            text={
              device
                ? "No messages yet. Paired senders' SMS will arrive here instantly."
                : 'Complete setup first.'
            }
          />
        }
      />
    </Screen>
  )
}
