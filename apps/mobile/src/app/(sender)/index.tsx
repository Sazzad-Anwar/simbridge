/**
 * Sender — Pairing Management (step 3): create a pairing request, share the
 * 6-digit code, manage active pairs.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  View,
} from 'react-native'
import { router } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Muted,
  PresencePill,
  Row,
  Screen,
  StatusPill,
  Title,
} from '@/components/ui'
import { DeviceIdentity } from '@/components/DeviceIdentity'
import { FingerprintConfirm } from '@/components/FingerprintConfirm'
import { colors } from '@/constants/theme'
import { useDeviceStore } from '@/stores/device-store'
import { useMessageStore } from '@/stores/message-store'
import { useScanStore } from '@/lib/scan-store'
import { pairingQrPayload } from '@/lib/qr'
import { api } from '@/lib/api'
import type { CreatePairResult, PairDTO } from '@simbridge/shared'

export default function SenderPairing() {
  const pairs = useDeviceStore((s) => s.pairs)
  const refreshPairs = useDeviceStore((s) => s.refreshPairs)
  const connection = useDeviceStore((s) => s.connection)
  const device = useDeviceStore((s) => s.device)
  const needsRepair = useDeviceStore((s) => s.needsRepair)
  const vaultError = useMessageStore((s) => s.vaultError)
  const scannedReceiverId = useScanStore((s) => s.receiverDeviceId)
  const setScannedReceiverId = useScanStore((s) => s.setReceiverDeviceId)
  const [receiverId, setReceiverId] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRequest, setLastRequest] = useState<CreatePairResult | null>(null)
  const lastRequestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const effectiveReceiverId = scannedReceiverId ?? receiverId
  const visiblePairs = pairs.filter((p) => p.status !== 'revoked')

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await refreshPairs()
    setRefreshing(false)
  }, [refreshPairs])

  useEffect(() => {
    void refreshPairs()
  }, [refreshPairs])

  // Clear the pending-timer on unmount.
  useEffect(() => {
    return () => {
      if (lastRequestTimer.current) clearTimeout(lastRequestTimer.current)
    }
  }, [])

  const createPair = async () => {
    const id = effectiveReceiverId.trim()
    if (!id) return
    setBusy(true)
    try {
      const result = await api.createPair({ receiverDeviceId: id })
      if (lastRequestTimer.current) clearTimeout(lastRequestTimer.current)
      setLastRequest(result)
      // Hide the QR + code card once the code stops being valid (2 min).
      lastRequestTimer.current = setTimeout(() => {
        setLastRequest(null)
        lastRequestTimer.current = null
      }, 2 * 60_000)
      setReceiverId('')
      setScannedReceiverId(null)
      await refreshPairs()
      Alert.alert(
        'Pairing requested',
        `Give this code to the receiver:\n\n${result.code}\n\nValid for 2 minutes.`,
      )
    } catch (err) {
      Alert.alert('Pairing failed', String(err))
    } finally {
      setBusy(false)
    }
  }

  const revoke = (pair: PairDTO) =>
    Alert.alert(
      'Revoke pair',
      'The receiver will stop receiving messages from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => void api.revokePair(pair.pairId).then(refreshPairs),
        },
      ],
    )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <FlatList
          data={visiblePairs}
          keyExtractor={(p) => p.pairId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.accentSoft}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 16 }}>
              <DeviceIdentity
                deviceId={device?.deviceId ?? '…'}
                deviceName={device?.name}
              />

              {needsRepair ? (
                <Card style={{ borderColor: colors.red }}>
                  <Title style={{ fontSize: 14, color: colors.red }}>
                    Identity conflict
                  </Title>
                  <Muted style={{ fontSize: 12 }}>
                    This install&apos;s keys diverge from the server identity.
                    Reinstall or remove this device and re-pair before verified
                    messaging resumes.
                  </Muted>
                </Card>
              ) : null}

              {vaultError ? (
                <Card style={{ borderColor: colors.red }}>
                  <Title style={{ fontSize: 14, color: colors.red }}>
                    Local vault unavailable
                  </Title>
                  <Muted style={{ fontSize: 12 }}>{vaultError}</Muted>
                </Card>
              ) : null}

              <Card>
                <Row>
                  <Title>New pairing</Title>
                  <Badge
                    label={connection === 'online' ? 'Connected' : connection}
                    tone={connection === 'online' ? 'green' : 'yellow'}
                  />
                </Row>
                <Muted>
                  Scan the receiver QR code or enter its deviceId, then share
                  the 6-digit code.
                </Muted>
                <Input
                  value={effectiveReceiverId}
                  onChangeText={(t) => {
                    setReceiverId(t)
                    if (scannedReceiverId) setScannedReceiverId(null)
                  }}
                  placeholder="dev_xxxxxxxxxxxx"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Row style={{ flexWrap: 'wrap' }}>
                  <Button
                    label="Scan receiver QR"
                    variant="ghost"
                    onPress={() => router.push('/(sender)/scan')}
                  />
                  <Button
                    label="Send pairing request"
                    onPress={() => void createPair()}
                    busy={busy}
                  />
                </Row>
              </Card>

              {lastRequest?.code ? (
                <Card style={{ alignItems: 'center' }}>
                  <Muted>Pairing code</Muted>
                  <Title
                    style={{
                      fontSize: 40,
                      letterSpacing: 8,
                      color: colors.accentSoft,
                    }}
                  >
                    {lastRequest.code}
                  </Title>
                  <View style={{ paddingVertical: 8 }}>
                    <QRCode
                      value={pairingQrPayload(
                        lastRequest.pairId,
                        lastRequest.code,
                      )}
                      size={180}
                      color={colors.text}
                      backgroundColor={colors.surface}
                    />
                  </View>
                  <Muted style={{ fontSize: 11 }}>
                    Receiver scans this QR (Scan tab) or enters the code.
                    Expires in 2 min.
                  </Muted>
                </Card>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const other =
              item.senderDeviceId === useDeviceStore.getState().device?.deviceId
                ? (item.receiverName ?? item.receiverDeviceId)
                : (item.senderName ?? item.senderDeviceId)
            const myDeviceId = useDeviceStore.getState().device?.deviceId ?? ''
            return (
              <Card style={{ marginBottom: 10 }}>
                <Row>
                  <Title style={{ fontSize: 15 }}>{other}</Title>
                  <StatusPill status={item.status} />
                  <PresencePill
                    status={item.peerStatus}
                    lastSeenAt={item.peerLastSeenAt}
                  />
                </Row>
                {item.status === 'active' ? (
                  <Muted>Paired · messages relay end-to-end encrypted</Muted>
                ) : (
                  <Muted>Waiting for the receiver to accept the code</Muted>
                )}
                {item.status === 'active' ? (
                  <FingerprintConfirm
                    pair={item}
                    myDeviceId={myDeviceId}
                  />
                ) : null}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Muted style={{ fontSize: 11 }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Muted>
                  <Button
                    label="Revoke"
                    variant="danger"
                    onPress={() => revoke(item)}
                  />
                </Row>
              </Card>
            )
          }}
          ListEmptyComponent={
            <Empty
              icon="🔗"
              text="No pairs yet. Create a pairing request and enter the code on your receiver device."
            />
          }
        />
      </Screen>
    </KeyboardAvoidingView>
  )
}
