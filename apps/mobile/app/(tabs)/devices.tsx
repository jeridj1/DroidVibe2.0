import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, LayoutAnimation, Platform, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Card, Badge, Button, Row, SectionTitle, EmptyState, HardwareStatusBadge, Modal, ListItem } from '@/src/components/ui';
import { 
  listDevices, 
  rescanDevices,
  requestPermission, 
  addDeviceListener, 
  isNativeUsbAvailable, 
  openSerial,
  getDeviceProtocol,
  getBoardInfo
} from '@/src/lib/transport';
import { identifyBoard, searchBoards } from '@droidvibe/shared';
import type { UsbDevice, BoardIdentity } from '@droidvibe/shared';

export default function DevicesScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BoardIdentity[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<UsbDevice | null>(null);
  const native = isNativeUsbAvailable();

  async function refresh() {
    const freshDevices = await rescanDevices();
    setDevices(freshDevices);
  }
  
  async function refreshWithRescan() {
    // Force a full rescan
    const freshDevices = await rescanDevices();
    setDevices(freshDevices);
  }

  useEffect(() => {
    refresh();
    const unsub = addDeviceListener((e) => {
      if (Platform.OS === 'android') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      if (e.type === 'attach') setDevices((prev) => [...prev.filter((d) => d.id !== e.device.id), e.device]);
      else setDevices((prev) => prev.filter((d) => d.id !== e.device.id));
    });
    return unsub;
  }, []);

  // Board search functionality
  useEffect(() => {
    if (searchQuery.length > 1) {
      const results = searchBoards(searchQuery, 20);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const identifiedCount = devices.filter((d) => identifyBoard(d.vendorId, d.productId)).length;

  // Get protocol info for devices
  const getProtocolForDevice = async (device: UsbDevice) => {
    try {
      const protocolInfo = await getDeviceProtocol(device.id);
      return protocolInfo.protocol;
    } catch (e) {
      // Fallback to board database
      const board = identifyBoard(device.vendorId, device.productId);
      return board?.protocol || 'unknown';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Devices</Text>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>
            {native
              ? devices.length + ' connected · ' + identifiedCount + ' identified'
              : 'Expo Go — native USB unavailable'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <Button title="Search Boards" onPress={() => setShowSearch(true)} variant="ghost" size="sm" />
          <Button title="Rescan" onPress={refreshWithRescan} variant="primary" size="sm" />
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState
            icon="🔌"
            title="No USB devices detected"
            subtitle={native ? 'Connect a board via USB-OTG cable.' : 'Build a DroidVibe dev/production build to access native USB.'}
          />
        }
        data={devices}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => {
          const board = identifyBoard(item.vendorId, item.productId);
          const protocol = board?.protocol || 'unknown';
          
          return (
            <Card style={{ marginBottom: 10 }}>
              <Row justify="space-between">
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>
                    {board?.name ?? item.productName ?? 'Unknown device'}
                  </Text>
                  <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>
                    {item.manufacturer ?? '—'} · VID {item.vendorId} PID {item.productId}
                  </Text>
                  {board && (
                    <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 2 }}>
                      FQBN: {board.fqbn}
                    </Text>
                  )}
                </View>
                <Badge label={item.bootsel ? 'BOOTSEL' : item.driver} tone={item.bootsel ? 'accent' : 'neutral'} />
              </Row>

              <Row gap={6} style={{ marginTop: 8 }}>
                <Badge label={protocol} tone="accent" />
                {board && <Badge label={board.manufacturer} tone="neutral" />}
              </Row>

              <Row gap={6} style={{ marginTop: 8 }}>
                <HardwareStatusBadge state={item.state} />
                <View style={{ flex: 1 }} />
                {item.permission !== 'granted' ? (
                  <Button
                    title="Allow access"
                    onPress={() => requestPermission(item.id).then(refresh)}
                    variant="ghost"
                    size="sm"
                  />
                ) : null}
                {item.permission === 'granted' && (
                  <>
                    <Button
                      title="Monitor"
                      onPress={() => {
                        router.push('/(tabs)/bench');
                      }}
                      variant="ghost"
                      size="sm"
                    />
                    <Button
                      title="Upload"
                      onPress={() => {
                        setSelectedDevice(item);
                      }}
                      size="sm"
                    />
                  </>
                )}
              </Row>

              {item.bootsel && (
                <Text style={{ color: palette.accent, fontSize: 11, marginTop: 6 }}>
                  RP2040 in BOOTSEL — ready for PICOBOOT flashing.
                </Text>
              )}
            </Card>
          );
        }}
      />

      {/* Board Search Modal */}
      <Modal
        visible={showSearch}
        onDismiss={() => setShowSearch(false)}
        title="Search Board Database"
      >
        <TextInput
          style={[styles.searchInput, { backgroundColor: palette.bgSecondary, color: palette.text }]}
          placeholder="Search by name, manufacturer, or FQBN..."
          placeholderTextColor={palette.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <FlatList
          data={searchResults}
          keyExtractor={(b) => b.fqbn + b.vendorId + b.productId}
          renderItem={({ item: board }) => (
            <ListItem
              title={board.name}
              subtitle={board.manufacturer + ' · ' + board.fqbn}
              rightLabel={board.protocol}
              onPress={() => {
                // Could filter devices by this board type
                setSearchQuery('');
                setShowSearch(false);
              }}
            />
          )}
          ListEmptyComponent={
            searchQuery.length > 1 ? (
              <Text style={{ color: palette.textMuted, textAlign: 'center', padding: 20 }}>
                No boards found matching "{searchQuery}"
              </Text>
            ) : (
              <Text style={{ color: palette.textMuted, textAlign: 'center', padding: 20 }}>
                Type to search the board database
              </Text>
            )
          }
        />
        
        <Button
          title="Close"
          onPress={() => {
            setSearchQuery('');
            setShowSearch(false);
          }}
          variant="ghost"
          style={{ marginTop: 16 }}
        />
      </Modal>

      {/* Device Actions Modal */}
      <Modal
        visible={selectedDevice !== null}
        onDismiss={() => setSelectedDevice(null)}
        title="Upload to Device"
      >
        {selectedDevice && (
          <>
            <Card style={{ marginBottom: 20 }}>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
                {identifyBoard(selectedDevice.vendorId, selectedDevice.productId)?.name || selectedDevice.productName || 'Unknown'}
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                VID: {selectedDevice.vendorId} | PID: {selectedDevice.productId}
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 4 }}>
                Protocol: {getBoardInfo(selectedDevice)?.protocol || 'auto-detect'}
              </Text>
            </Card>
            
            <Button
              title="Select Sketch and Upload"
              onPress={() => {
                setSelectedDevice(null);
                router.push('/(tabs)/sketches');
              }}
              variant="primary"
            />
            
            <Button
              title="Cancel"
              onPress={() => setSelectedDevice(null)}
              variant="ghost"
              style={{ marginTop: 12 }}
            />
          </>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
});
