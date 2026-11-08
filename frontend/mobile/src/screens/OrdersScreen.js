import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../config/api';

const labels = {
  PLACED: 'Placed', ESCROW_HELD: 'Simulated payment secured', DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered', SETTLED: 'Simulated settlement', CANCELLED: 'Cancelled'
};
const payments = { PENDING: 'Pending', ESCROW_SECURED: 'Simulated: secured', PAID_TO_FARMER: 'Simulated: settled', REFUNDED: 'Simulated: refunded' };

export default function OrdersScreen() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    const response = await apiRequest('/orders/my-orders', {}, token);
    if (response.success && Array.isArray(response.orders)) { setOrders(response.orders); setError(''); }
    else setError(response.message || 'Could not load orders.');
    setLoading(false); setRefreshing(false);
  };
  useEffect(() => { load(); }, [token]);

  const transition = (order, nextStatus, label) => {
    Alert.alert(label, nextStatus === 'ESCROW_HELD' || nextStatus === 'SETTLED' ? 'This only changes a demo status. No money is transferred.' : 'Update the status of this order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        if (updating) return;
        setUpdating(order._id);
        const response = await apiRequest(`/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ nextStatus }) }, token);
        setUpdating(null);
        if (!response.success) Alert.alert('Could not update order', response.message || 'Please try again.');
        await load(true);
      } }
    ]);
  };

  const renderOrder = ({ item }) => {
    const buyer = String(item.buyer?._id || item.buyer) === String(user?._id);
    const farmer = String(item.farmer?._id || item.farmer) === String(user?._id);
    const action = item.orderStatus === 'PLACED' && buyer ? ['ESCROW_HELD', 'Simulate payment'] :
      item.orderStatus === 'ESCROW_HELD' && farmer ? ['DISPATCHED', 'Mark dispatched'] :
      item.orderStatus === 'DISPATCHED' && buyer ? ['DELIVERED', 'Confirm delivery'] :
      item.orderStatus === 'DELIVERED' && buyer ? ['SETTLED', 'Simulate settlement'] : null;
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{item.cropName} · {item.orderNumber}</Text>
        <Text style={styles.text}>{item.quantity} {item.unit} × ₹{item.unitPrice} = ₹{item.totalAmount}</Text>
        <Text style={styles.text}>{buyer ? 'Farmer' : 'Buyer'}: {(buyer ? item.farmer : item.buyer)?.name || 'Unknown'}</Text>
        <Text style={styles.status}>Order: {labels[item.orderStatus] || item.orderStatus}</Text>
        <Text style={styles.text}>Payment: {payments[item.paymentStatus] || item.paymentStatus}</Text>
        <Text style={styles.heading}>Order history</Text>
        {(item.timeline || []).map((entry, index) => <Text key={entry._id || index} style={styles.history}>{labels[entry.status] || entry.status} · {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN') : ''}</Text>)}
        {action && <TouchableOpacity style={styles.button} disabled={!!updating} onPress={() => transition(item, ...action)} accessibilityRole="button"><Text style={styles.buttonText}>{updating === item._id ? 'Updating…' : action[1]}</Text></TouchableOpacity>}
      </View>
    );
  };
  return (
    <View style={styles.container}>
      <Text style={styles.header}>📦 My orders</Text>
      <Text style={styles.notice}>Demo only: payment and settlement statuses are simulated; no money is transferred.</Text>
      {!!error && <TouchableOpacity onPress={() => load()}><Text style={styles.error}>{error} Tap to retry.</Text></TouchableOpacity>}
      {loading ? <ActivityIndicator color="#10B981" size="large" /> : <FlatList data={orders} keyExtractor={(item) => item._id} renderItem={renderOrder} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#10B981" />} ListEmptyComponent={<Text style={styles.text}>{error ? 'Orders could not be loaded.' : 'No orders yet. Accepted deals can be placed as orders by the buyer.'}</Text>} />}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 16 }, header: { color: '#10B981', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  notice: { color: '#FCD34D', backgroundColor: '#422006', padding: 10, borderRadius: 8, marginBottom: 12 },
  list: { paddingBottom: 24 }, card: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 12, gap: 6 },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' }, text: { color: '#CBD5E1', fontSize: 13 },
  status: { color: '#34D399', fontWeight: 'bold' }, heading: { color: '#F8FAFC', marginTop: 8, fontWeight: '600' },
  history: { color: '#94A3B8', fontSize: 12 }, button: { backgroundColor: '#10B981', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0F172A', fontWeight: 'bold' }, error: { color: '#FCA5A5', marginBottom: 12 }
});
