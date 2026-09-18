/**
 * Role selection (step 2 of the flow): Sender or Receiver.
 * Registers the device with its freshly generated public key.
 */
import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Button, Card, Muted, Row, Screen, Title } from '@/components/ui'
import { colors } from '@/constants/theme'
import { useDeviceStore } from '@/stores/device-store'
import { isValidPhoneNumber, normalizePhoneNumber } from '@simbridge/shared'

export default function RoleSelect() {
  const router = useRouter()
  const registered = useDeviceStore((s) => s.registered)
  const [busy, setBusy] = useState<'sender' | 'receiver' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (registered) {
    const role = useDeviceStore.getState().profile?.role
    return <Redirect href={role === 'receiver' ? '/(receiver)' : '/(sender)'} />
  }

  const choose = async (role: 'sender' | 'receiver') => {
    setBusy(role)
    setError(null)
    try {
      const profile = useDeviceStore.getState().profile
      if (!profile?.name || !isValidPhoneNumber(normalizePhoneNumber(profile.name))) {
        setError('Missing phone number — go back and enter it first')
        return
      }
      await useDeviceStore.getState().registerDevice({
        name: normalizePhoneNumber(profile.name),
        role,
      })
      const finalRole = useDeviceStore.getState().profile?.role ?? role
      router.replace(finalRole === 'receiver' ? '/(receiver)' : '/(sender)')
    } catch (err) {
      console.log(err)
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Screen style={{ justifyContent: 'center', gap: 16 }}>
      <Title style={{ fontSize: 24, textAlign: 'center' }}>
        Choose your role
      </Title>
      <Muted style={{ textAlign: 'center', marginBottom: 8 }}>
        The sender keeps the SIM active and forwards incoming SMS. The receiver
        gets them instantly and securely.
      </Muted>

      <Pressable
        onPress={() => void choose('sender')}
        disabled={busy !== null}
        accessibilityRole="button"
        accessibilityLabel="Choose sender role"
      >
        {({ pressed }) => (
          <Card
            style={[
              styles.roleCard,
              pressed && { opacity: 0.8 },
              busy === 'receiver' && { opacity: 0.4 },
            ]}
          >
            <Row>
              <Text style={{ fontSize: 32 }}>📱</Text>
              <View style={{ flex: 1 }}>
                <Title>Sender</Title>
                <Muted>
                  This device holds the SIM. It detects incoming SMS in the
                  background, encrypts them and forwards to your receiver.
                </Muted>
              </View>
            </Row>
            <Muted style={{ fontSize: 11 }}>
              Needs SMS permissions + a persistent foreground service
            </Muted>
          </Card>
        )}
      </Pressable>

      <Pressable
        onPress={() => void choose('receiver')}
        disabled={busy !== null}
        accessibilityRole="button"
        accessibilityLabel="Choose receiver role"
      >
        {({ pressed }) => (
          <Card
            style={[
              styles.roleCard,
              pressed && { opacity: 0.8 },
              busy === 'sender' && { opacity: 0.4 },
            ]}
          >
            <Row>
              <Text style={{ fontSize: 32 }}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Title>Receiver</Title>
                <Muted>
                  This device receives forwarded SMS in real time, decrypts them
                  locally and syncs missed messages on reconnect.
                </Muted>
              </View>
            </Row>
            <Muted style={{ fontSize: 11 }}>No SMS permissions required</Muted>
          </Card>
        )}
      </Pressable>

      {error ? (
        <Muted style={{ color: colors.red, textAlign: 'center' }}>
          {error}
        </Muted>
      ) : null}
      <Button
        label="Back"
        variant="ghost"
        onPress={() => router.back()}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  roleCard: { gap: 12, padding: 20 },
})
