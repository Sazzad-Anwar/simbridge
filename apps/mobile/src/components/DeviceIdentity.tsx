import React, { useState } from "react";
import { Alert, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Button, Card, Muted, Row, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { deviceQrPayload } from "@/lib/qr";

export function DeviceIdentity({
  deviceId,
  deviceName,
  title = "My device",
}: {
  deviceId: string;
  deviceName?: string;
  title?: string;
}) {
  const [showQr, setShowQr] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(deviceId);
    Alert.alert("Copied", "Device ID copied to the clipboard.");
  };

  return (
    <Card>
      <Title>{title}</Title>
      <Muted>
        Share this ID with the other device, or let it scan the QR code below.
      </Muted>
      <Muted style={{ fontSize: 13, color: colors.text }}>{deviceId}</Muted>
      <Row style={{ flexWrap: "wrap" }}>
        <Button label="Copy ID" variant="ghost" onPress={() => void copy()} />
        <Button
          label={showQr ? "Hide QR" : "Show QR"}
          variant="ghost"
          onPress={() => setShowQr((v) => !v)}
        />
      </Row>
      {showQr ? (
        <View style={{ alignItems: "center", paddingVertical: 12, gap: 8 }}>
          <QRCode
            value={deviceQrPayload(deviceId)}
            size={200}
            color={colors.text}
            backgroundColor={colors.surface}
          />
          {deviceName ? <Muted style={{ fontSize: 11 }}>{deviceName}</Muted> : null}
        </View>
      ) : null}
    </Card>
  );
}
