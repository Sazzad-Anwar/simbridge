/**
 * Fingerprint confirmation (V1 trust anchor). Shows the OTHER device's
 * identity fingerprint so the user can compare out-of-band (QR, in person) and
 * explicitly confirm it. V1 signed-envelope messaging is only unlocked once
 * BOTH sides have confirmed.
 */
import React, { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import type { PairDTO } from '@simbridge/shared'
import {
  iConfirmedPeer,
  isV1Pair,
  peerConfirmedMe,
  peerIdentity,
} from '@simbridge/shared'
import { api } from '@/lib/api'
import { useDeviceStore } from '@/stores/device-store'
import { colors } from '@/constants/theme'
import { Badge, Button, Muted, Row } from '@/components/ui'

export function FingerprintConfirm({
  pair,
  myDeviceId,
  compact,
}: {
  pair: PairDTO
  myDeviceId: string
  compact?: boolean
}) {
  const refreshPairs = useDeviceStore((s) => s.refreshPairs)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isV1Pair(pair)) {
    return (
      <View style={{ gap: 4 }}>
        <Muted style={{ fontSize: 12 }}>
          Legacy pair — signed-envelope messaging needs both devices to upgrade.
        </Muted>
      </View>
    )
  }

  const peer = peerIdentity(pair, myDeviceId)
  const iConfirmed = iConfirmedPeer(pair, myDeviceId)
  const peerConfirmed = peerConfirmedMe(pair, myDeviceId)
  const verified = iConfirmed && peerConfirmed

  const confirm = async () => {
    setBusy(true)
    try {
      await api.confirmPairFingerprint(pair.pairId)
      await refreshPairs()
      Alert.alert(
        'Fingerprint verified',
        "This device's identity matches what your paired device shows. Messages between you are now verified and signed.",
      )
    } catch (err) {
      Alert.alert('Verification failed', String(err))
    } finally {
      setBusy(false)
    }
  }

  const copy = () => {
    void Clipboard.setStringAsync(peer.signingKeyFingerprint ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        {verified ? (
          <Badge label="✓ Verified" tone="green" />
        ) : (
          <Muted style={{ fontSize: 12, color: colors.yellow }}>
            Not verified yet
          </Muted>
        )}
        {!iConfirmed && !peerConfirmed ? (
          <Muted style={{ fontSize: 11 }}>compare fingerprints</Muted>
        ) : null}
      </Row>
      <View
        style={{
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          padding: 10,
          gap: 6,
        }}
      >
        <Muted style={{ fontSize: 11 }}>
          {compact ? 'Peer fingerprint' : 'Other device’s fingerprint — compare on the other phone'}
        </Muted>
        <Text
          selectable
          style={{ color: colors.text, fontSize: 12, fontFamily: 'monospace', letterSpacing: 0.5 }}
        >
          {peer.signingKeyFingerprint ?? '—'}
        </Text>
      </View>
      <Row style={{ flexWrap: 'wrap' }}>
        {!iConfirmed ? (
          <Button label="Confirm fingerprint" onPress={() => void confirm()} busy={busy} />
        ) : null}
        <Button label={copied ? 'Copied ✓' : 'Copy'} variant="ghost" onPress={copy} />
      </Row>
      {iConfirmed && !peerConfirmed ? (
        <Muted style={{ fontSize: 11 }}>
          Waiting for the other device to verify yours — messaging unlocks once both sides confirm.
        </Muted>
      ) : null}
      {verified ? (
        <Muted style={{ fontSize: 11, color: colors.green }}>
          Messages are signed by the verified device and cannot be spoofed.
        </Muted>
      ) : null}
    </View>
  )
}