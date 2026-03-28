import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, Star, Filter, TrendingUp, ChevronDown, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getWebBaseUrl } from '@/lib/web-url';


export default function FindAdvocateScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const router = useRouter();

    const { user } = useAuth();
    const role = user?.user_metadata?.role || 'advocate';

    useEffect(() => {
        if (role !== 'client') {
            router.replace('/(tabs)');
        }
    }, [role]);

    const [advocates, setAdvocates] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null);
    const [specializations, setSpecializations] = useState<any[]>([]);
    
    // Dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Specializations
            const { data: specs, error: specError } = await supabase.from('specializations').select('*');

            if (specError) console.error('Error fetching specializations:', specError);
            
            const fallbackSpecs = [
                {id: '1', label: 'Civil Law', value: 'civil'},
                {id: '2', label: 'Criminal Law', value: 'criminal'},
                {id: '3', label: 'Family Law', value: 'family'},
                {id: '4', label: 'Corporate Law', value: 'corporate'},
                {id: '5', label: 'Property Law', value: 'property'},
                {id: '6', label: 'Tax Law', value: 'tax'},
                {id: '7', label: 'Immigration', value: 'immigration'},
                {id: '8', label: 'IPR', value: 'ipr'},
                {id: '9', label: 'Consumer', value: 'consumer'}
            ];

            if (!specs || specs.length === 0) {
                console.log('Using fallback specializations');
                setSpecializations(fallbackSpecs);
            } else {
                setSpecializations(specs);
            }

            // Primary source: web API with aggregated stats.
            // Fallback: direct Supabase query (real data without aggregated stats).
            try {
                const { data: authData } = await supabase.auth.getSession();
                const token = authData.session?.access_token;
                if (!token) throw new Error('Not authenticated');

                const response = await fetch(`${getWebBaseUrl()}/api/public/advocates`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload?.error || 'Failed to fetch advocates');
                }

                const payload = await response.json();
                setAdvocates(payload?.advocates || []);
            } catch (apiError) {
                console.error('Advocate API fetch failed, using direct Supabase fallback:', apiError);
                const { data: advs, error } = await supabase
                    .from('advocates')
                    .select(`
                        user_id,
                        full_name,
                        specialization,
                        experience_years,
                        profile_photo_url,
                        bio,
                        bar_council_state,
                        is_verified
                    `);

                if (error) throw error;

                const normalized = (advs || []).map((adv: any) => ({
                    ...adv,
                    stats: { total: 0, byType: {} as Record<string, number> }
                }));
                setAdvocates(normalized);
            }

        } catch (error) {
            console.error('Error fetching advocates:', error);
            setAdvocates([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredAdvocates = advocates.filter(adv => {
        const matchesSearch = 
            adv.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            adv.bar_council_state?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesSpec = selectedSpecialization 
            ? adv.specialization?.includes(selectedSpecialization) 
            : true;
        return matchesSearch && matchesSpec;
    }).sort((a, b) => (b?.stats?.total || 0) - (a?.stats?.total || 0));

    const renderAdvocate = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push(`/find-advocate/${item.user_id}`)}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: theme.surfaceVariant }]}>
                    {item.profile_photo_url ? (
                        <Image
                            source={{ uri: item.profile_photo_url }}
                            style={styles.avatarImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text style={[styles.avatarText, { color: theme.tint }]}>
                            {item.full_name?.substring(0, 2).toUpperCase()}
                        </Text>
                    )}
                </View>
                <View style={styles.headerInfo}>
                    <Text style={[styles.name, { color: theme.text }]}>{item.full_name}</Text>
                    <View style={styles.row}>
                        <MapPin size={12} color={theme.icon} />
                        <Text style={[styles.location, { color: theme.icon }]}>
                            {item.city || item.bar_council_state || 'Location N/A'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.specs}>
                {item.specialization?.slice(0, 3).map((spec: string, i: number) => (
                    <View key={i} style={[styles.pill, { backgroundColor: theme.background }]}>
                        <Text style={[styles.pillText, { color: theme.text }]}>
                            {specializations.find(s => s.value === spec)?.label || spec}
                        </Text>
                    </View>
                ))}
                {item.specialization?.length > 3 && (
                     <Text style={[styles.moreSpecs, { color: theme.icon }]}>+{item.specialization.length - 3}</Text>
                )}
            </View>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
                 <View style={styles.stat}>
                     <Briefcase size={14} color={theme.icon} />
                     <Text style={[styles.statText, { color: theme.text }]}>{item?.stats?.total || 0} Cases</Text>
                 </View>
                 <View style={styles.stat}>
                     <Star size={14} color="#F59E0B" />
                     <Text style={[styles.statText, { color: theme.text }]}>
                         {item.experience_years || 'N/A'} Years Exp
                     </Text>
                 </View>
            </View>
        </TouchableOpacity>
    );

    const getSelectedLabel = () => {
        if (!selectedSpecialization) return 'All Specializations';
        return specializations.find(s => s.value === selectedSpecialization)?.label || 'All Specializations';
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ title: 'Find Advocate', headerShadowVisible: false }} />
            
            {/* Search Header */}
            <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
                <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Search size={20} color={theme.icon} />
                    <TextInput 
                        style={[styles.input, { color: theme.text }]}
                        placeholder="Search advocates or locations..."
                        placeholderTextColor={theme.icon}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                
                {/* Dropdown Trigger */}
                <TouchableOpacity 
                    style={[styles.dropdownTrigger, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <Text style={[styles.dropdownText, { color: theme.text }]}>{getSelectedLabel()}</Text>
                    <ChevronDown size={20} color={theme.icon} />
                </TouchableOpacity>

                {/* Dropdown Content */}
                {isDropdownOpen && (
                    <View style={[styles.dropdownList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                            <TouchableOpacity 
                                style={[styles.dropdownItem, !selectedSpecialization && styles.selectedItem]}
                                onPress={() => { setSelectedSpecialization(null); setIsDropdownOpen(false); }}
                            >
                                <Text style={[styles.itemText, { color: theme.text }]}>All Specializations</Text>
                                {!selectedSpecialization && <Check size={16} color={theme.tint} />}
                            </TouchableOpacity>
                            
                            {specializations.map(spec => (
                                <TouchableOpacity 
                                    key={spec.id}
                                    style={[styles.dropdownItem, selectedSpecialization === spec.value && styles.selectedItem]}
                                    onPress={() => { setSelectedSpecialization(spec.value); setIsDropdownOpen(false); }}
                                >
                                    <Text style={[styles.itemText, { color: theme.text }]}>{spec.label}</Text>
                                    {selectedSpecialization === spec.value && <Check size={16} color={theme.tint} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.tint} />
                </View>
            ) : (
                <FlatList 
                    data={filteredAdvocates}
                    renderItem={renderAdvocate}
                    keyExtractor={item => item.user_id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={{ color: theme.icon }}>No advocates found matching your criteria.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    searchContainer: { padding: 16, paddingBottom: 12 },
    searchBar: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 12, 
        height: 48, 
        borderRadius: 12, 
        borderWidth: 1,
        marginBottom: 12
    },
    input: { flex: 1, marginLeft: 8, fontSize: 16 },
    
    // Dropdown Styles
    dropdownTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 4,
    },
    dropdownText: {
        fontSize: 14,
        fontWeight: '600',
    },
    dropdownList: {
        position: 'absolute',
        top: 120, // Adjust based on search bar height
        left: 16,
        right: 16,
        borderRadius: 12,
        borderWidth: 1,
        zIndex: 1000,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        maxHeight: 250,
    },
    dropdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
    },
    selectedItem: {
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    itemText: {
        fontSize: 14,
    },

    list: { padding: 16, paddingTop: 16 },
    card: { 
        borderRadius: 16, 
        borderWidth: 1, 
        marginBottom: 16, 
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', padding: 16, alignItems: 'flex-start' },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    avatarImage: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { fontSize: 18, fontWeight: '700' },
    headerInfo: { flex: 1, marginLeft: 12 },
    name: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    location: { fontSize: 13 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    specs: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    pillText: { fontSize: 12, fontWeight: '500' },
    moreSpecs: { fontSize: 12, alignSelf: 'center' },
    footer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, justifyContent: 'space-around' },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statText: { fontSize: 13, fontWeight: '600' },
    empty: { alignItems: 'center', marginTop: 40 }
});
