import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { MessageSquare, MapPin, Briefcase, Star, TrendingUp, CheckCircle, Shield, Globe } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getWebBaseUrl } from '@/lib/web-url';

export default function AdvocateProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const [advocate, setAdvocate] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

    useEffect(() => {
        if (id) fetchProfile();
    }, [id]);

    const fetchProfile = async () => {
        try {
            try {
                const { data: authData } = await supabase.auth.getSession();
                const token = authData.session?.access_token;
                if (!token) throw new Error('Not authenticated');

                const response = await fetch(`${getWebBaseUrl()}/api/public/advocates/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload?.error || 'Failed to fetch advocate profile');
                }

                const payload = await response.json();
                const profile = payload?.advocate;
                if (!profile) throw new Error('Advocate not found');

                setAdvocate(profile);

                const byType = profile?.stats?.byType || {};
                const breakdown = Object.entries(byType)
                    .map(([name, count]) => ({ name, count: Number(count) }))
                    .sort((a, b) => b.count - a.count);

                setStats({
                    total_cases: profile?.stats?.total || 0,
                    experience_years: profile?.experience_years || 0,
                    breakdown
                });
            } catch (apiError) {
                console.error('Advocate detail API failed, using direct Supabase fallback:', apiError);
                const { data: profile, error } = await supabase
                    .from('advocates')
                    .select('*')
                    .eq('user_id', id)
                    .single();
                if (error) throw error;

                setAdvocate(profile);
                setStats({
                    total_cases: 0,
                    experience_years: profile?.experience_years || 0,
                    breakdown: []
                });
            }

        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.tint} />
            </View>
        );
    }

    if (!advocate) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
                <Text style={{ color: theme.text }}>Advocate not found.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ title: 'Advocate Profile', headerShadowVisible: false }} />
            
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header Card */}
                <View style={[styles.header, { backgroundColor: theme.surface }]}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            style={[styles.avatar, { backgroundColor: theme.surfaceVariant }]}
                            activeOpacity={advocate.profile_photo_url ? 0.85 : 1}
                            onPress={() => advocate.profile_photo_url && setPhotoViewerOpen(true)}
                            disabled={!advocate.profile_photo_url}
                        >
                            {advocate.profile_photo_url ? (
                                <Image
                                    source={{ uri: advocate.profile_photo_url }}
                                    style={styles.avatarImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text style={[styles.avatarText, { color: theme.tint }]}>
                                    {advocate.full_name?.substring(0, 2).toUpperCase()}
                                </Text>
                            )}
                        </TouchableOpacity>
                        <View style={styles.headerContent}>
                            <Text style={[styles.name, { color: theme.text }]}>{advocate.full_name}</Text>
                            <View style={styles.badgeRow}>
                                <CheckCircle size={14} color={theme.tint} />
                            <Text style={[styles.verified, { color: theme.tint }]}>
                                {advocate.is_verified ? 'Verified Advocate' : 'Advocate'}
                            </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                            <Briefcase size={20} color={theme.icon} />
                            <Text style={[styles.statValue, { color: theme.text }]}>{stats?.total_cases || 0}</Text>
                            <Text style={[styles.statLabel, { color: theme.icon }]}>Cases</Text>
                        </View>
                        
                        <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                            <Star size={20} color="#F59E0B" />
                            <Text style={[styles.statValue, { color: theme.text }]}>{advocate.experience_years}+</Text>
                            <Text style={[styles.statLabel, { color: theme.icon }]}>Years Exp</Text>
                        </View>
                    </View>
                </View>

                     <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Specializations</Text>
                    <View style={styles.chips}>
                        {advocate.specialization?.map((spec: string, i: number) => (
                            <View key={i} style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Text style={[styles.chipText, { color: theme.text }]}>{spec.replace(/_/g, ' ').toUpperCase()}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Metadata */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Practice Areas</Text>
                    
                    <View style={styles.metaRow}>
                        <MapPin size={18} color={theme.icon} />
                        <Text style={[styles.metaText, { color: theme.text }]}>
                            {advocate.bar_council_state || 'Location Not Listed'}
                        </Text>
                    </View>
                    
                    {Array.isArray(advocate.languages) && advocate.languages.length > 0 && (
                        <View style={styles.metaRow}>
                            <Globe size={18} color={theme.icon} />
                            <Text style={[styles.metaText, { color: theme.text }]}>
                                {advocate.languages.join(', ')}
                            </Text>
                        </View>
                    )}

                     <View style={styles.metaRow}>
                        <Shield size={18} color={theme.icon} />
                        <Text style={[styles.metaText, { color: theme.text }]}>
                            BAR: {advocate.bar_registration_number || 'Not listed'}
                        </Text>
                    </View>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
                    <Text style={[styles.bio, { color: theme.text }]}>
                        {advocate.bio || "No biography available."}
                    </Text>
                </View>

                {/* Case Breakdown Section */}
                {stats?.breakdown?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Cases by Specialization</Text>
                        <View style={{ gap: 12 }}>
                            {stats.breakdown.map((item: any) => (
                                <View key={item.name}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '500', color: theme.text, textTransform: 'capitalize' }}>
                                            {item.name}
                                        </Text>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                                            {item.count}
                                        </Text>
                                    </View>
                                    <View style={{ height: 8, backgroundColor: theme.surfaceVariant, borderRadius: 4, overflow: 'hidden' }}>
                                        <View style={{ 
                                            height: '100%', 
                                            backgroundColor: theme.tint, 
                                            width: `${(item.count / stats.total_cases) * 100}%`,
                                            borderRadius: 4
                                        }} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

            </ScrollView>

            {/* Bottom Action */}
            <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
                <TouchableOpacity 
                    style={[styles.connectButton, { backgroundColor: theme.tint }]}
                    onPress={() => {
                        // Navigate to chat with params
                        router.push(`/messages/${advocate.user_id}?name=${encodeURIComponent(advocate.full_name)}`);
                    }}
                >
                    <MessageSquare size={20} color="white" />
                    <Text style={styles.connectText}>Connect Now</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={photoViewerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setPhotoViewerOpen(false)}
            >
                <Pressable style={styles.photoOverlay} onPress={() => setPhotoViewerOpen(false)}>
                    {advocate.profile_photo_url ? (
                        <Image
                            source={{ uri: advocate.profile_photo_url }}
                            style={styles.photoPreview}
                            resizeMode="contain"
                        />
                    ) : null}
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowOpacity: 0.1, elevation: 4 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginRight: 16, overflow: 'hidden' },
    avatarImage: { width: 64, height: 64, borderRadius: 32 },
    avatarText: { fontSize: 24, fontWeight: '700' },
    headerContent: { flex: 1 },
    name: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    verified: { fontSize: 14, fontWeight: '600' },
    
    statsGrid: { flexDirection: 'row', gap: 12 },
    statItem: { flex: 1, padding: 12, borderRadius: 16, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '700', marginVertical: 4 },
    statLabel: { fontSize: 12 },

    section: { padding: 20, paddingBottom: 0 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    bio: { fontSize: 15, lineHeight: 24, opacity: 0.8 },
    
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
    chipText: { fontSize: 12, fontWeight: '600' },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    metaText: { fontSize: 15 },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, borderTopWidth: 1 },
    connectButton: { flexDirection: 'row', height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', gap: 10, shadowOpacity: 0.2, elevation: 4 },
    connectText: { color: 'white', fontSize: 18, fontWeight: '700' },
    photoOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    photoPreview: {
        width: '100%',
        height: '75%',
        borderRadius: 12,
    },
});
