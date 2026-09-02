import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useInstructors } from '../hooks/useInstructors'
import { useLessons } from '../hooks/useLessons'
import { useTable } from '../hooks/useSupabase'
import { useBookings, useBookingParticipants } from '../hooks/useBookings'
import { usePriceTiers } from '../hooks/usePriceTiers'
import type { Instructor, Lesson, BillableType, PriceItem, PriceTier, PriceCategory, SharedLink, SharedLinkType, TaxiPricingDefaults, TaxiDriver, BookingStatus, KiteLevel } from '../types/database'
import AccommodationsTab from '../components/management/AccommodationsTab'
import SeasonsTab from '../components/management/SeasonsTab'
import SourcesTab from '../components/management/SourcesTab'
import DatabaseTab from '../components/management/DatabaseTab'
import AgenciesTab from '../components/management/AgenciesTab'
import TransferReferencePricesTab from '../components/management/TransferReferencePricesTab'
import { todayISO, addDaysISO, fmtDate } from '../utils/dates'

const KITE_LEVEL_LABELS: Record<KiteLevel, string> = {
  'beg-total':      'Beg-Total',
  'beg-bodydrag':   'Beg-BodyDrag',
  'beg-waterstart': 'Beg-WaterStart',
  'intermediate':   'Intermediate',
  'advanced':       'Advanced',
}
const KITE_LEVEL_COLORS: Record<KiteLevel, string> = {
  'beg-total':      'bg-lime-100 dark:bg-lime-900/30 text-lime-800 dark:text-lime-400',
  'beg-bodydrag':   'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
  'beg-waterstart': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
  'intermediate':   'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  'advanced':       'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400',
}
const STATUS_COLORS: Record<BookingStatus, string> = {
  confirmed:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  provisional: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  cancelled:   'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

const specialtyOptions = ['Beg-Total', 'Beg-BodyDrag', 'Beg-WaterStart', 'Intermediate', 'Advanced', 'Wave', 'Freestyle']
const specialtyValues = ['beg-total', 'beg-bodydrag', 'beg-waterstart', 'intermediate', 'advanced', 'wave', 'freestyle']

const priceCategoryLabels: Record<PriceCategory, string> = {
  'lesson': 'Lessons',
  'activity': 'Activities',
  'rental': 'Rentals',
  'meal': 'Meals',
  'center_access': 'Center access',
}

// ── Rates that actually bill something ───────────────────────────────────────
// A row carrying a billable_type is what the app charges for that post. Its NAME
// bills nothing — the link does. So the name, the category and the link itself are
// locked once set, and the row cannot be deleted: renaming or deleting it used to
// silently fall back to a price no screen ever showed. Everything without a link
// stays a free catalogue entry, fully editable.

const BILLABLE_LABELS: Record<BillableType, string> = {
  lesson_private:     'Private lessons',
  lesson_group:       'Group lessons (per student)',
  lesson_supervision: 'Supervision',
  rental_kite:        'Kite',
  rental_board:       'Board',
  rental_full:        'Full (kite + board)',
  rental_surfboard:   'Surfboard',
  rental_foilboard:   'Foilboard',
  center_access:      'Center access (per person per day)',
  meal:               'Dinners (the price a new one opens at)',
}

/** Which posts belong to which section of the screen. Mirrors the CHECK in
 *  2026-07-30_billable_types.sql — the two must stay in step. */
const CATEGORY_BILLABLES: Partial<Record<PriceCategory, BillableType[]>> = {
  lesson:        ['lesson_private', 'lesson_group', 'lesson_supervision'],
  rental:        ['rental_kite', 'rental_board', 'rental_full', 'rental_surfboard', 'rental_foilboard'],
  center_access: ['center_access'],
  meal:          ['meal'],
}

const billedBy = (p: PriceItem): string | null =>
  p.billable_type ? BILLABLE_LABELS[p.billable_type] : null

const LINK_TYPE_LABELS: Record<SharedLinkType, { icon: string; label: string }> = {
  forecast:          { icon: '📋', label: 'Forecast Lesson/Rent' },
  taxi:              { icon: '🚕', label: 'Public Taxi Schedule' },
  client:            { icon: '👤', label: 'Client Account' },
  driver:            { icon: '🚗', label: 'Taxi Driver Schedule' },
  taxi_manager:      { icon: '🧑‍💼', label: 'Taxi Manager GERALDO schedule' },
  activity_provider: { icon: '🏕️', label: 'Activity Provider' },
  booking_form:      { icon: '📝', label: 'Public Booking Form' },
  restaurant:        { icon: '🍽️', label: 'Hotel Restaurant Planning' },
  enquiry_form:      { icon: '📣', label: 'Website Enquiry Form (iframe)' },
}

function generateToken(type: SharedLinkType) {
  return `${type}_${crypto.randomUUID()}`
}

function getBaseUrl() {
  return `${window.location.protocol}//${window.location.host}`
}

export default function ManagementPage() {
  const [tab, setTab] = useState<'instructors' | 'houses' | 'pricing' | 'seasons' | 'sources' | 'agencies' | 'links' | 'bookguest' | 'database'>('instructors')
  const [pricingSubTab, setPricingSubTab] = useState<'rates' | 'reference'>('rates')

  // ── Bookings & Guests tab ─────────────────────────────────────────────────
  const { data: allBookings } = useBookings()
  const { data: allParticipants } = useBookingParticipants()
  const [bgSearch, setBgSearch] = useState('')
  const [bgTimeFilter, setBgTimeFilter] = useState<'all' | 'active' | 'upcoming' | 'past'>('all')
  const [bgStatusFilter, setBgStatusFilter] = useState<'' | BookingStatus>('')
  const [bgOpenId, setBgOpenId] = useState<string | null>(null)

  // ── Instructors (Supabase) ─────────────────────────────────────────────────
  const { data: instructorsData, refresh: refreshInstructors } = useInstructors()
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  const [showInstructorForm, setShowInstructorForm] = useState(false)
  const [instructorFormData, setInstructorFormData] = useState<Partial<Instructor>>({})
  const [instructorDetailTab, setInstructorDetailTab] = useState<'info' | 'lessons'>('info')
  const [searchInstructor, setSearchInstructor] = useState('')

  useEffect(() => { setInstructors(instructorsData) }, [instructorsData])

  // ── Lessons (Supabase, read-only here) ────────────────────────────────────
  const { data: lessons } = useLessons()

  // ── Pricing (Supabase) ────────────────────────────────────────────────────
  const { data: priceItemsData, refresh: refreshPriceItems } = useTable<PriceItem>('price_items')
  const [priceItems, setPriceItems] = useState<PriceItem[]>([])
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [priceFormData, setPriceFormData] = useState<Partial<PriceItem>>({})
  const [selectedPriceCategory, setSelectedPriceCategory] = useState<PriceCategory>('lesson')

  useEffect(() => { setPriceItems(priceItemsData) }, [priceItemsData])

  // ── Volume tiers on top of lesson_private/lesson_group (2026-08-16) ──────
  const { data: priceTiersData, refresh: refreshPriceTiers } = usePriceTiers()
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [newTierHours, setNewTierHours] = useState<Record<string, string>>({})
  const [newTierPrice, setNewTierHoursPrice] = useState<Record<string, string>>({})

  useEffect(() => { setPriceTiers(priceTiersData) }, [priceTiersData])

  async function handleAddTier(billableType: 'lesson_private' | 'lesson_group') {
    const hours = parseFloat(newTierHours[billableType] ?? '')
    const price = parseFloat(newTierPrice[billableType] ?? '')
    if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(price) || price < 0) return
    const { error } = await supabase.from('price_tiers')
      .insert([{ billable_type: billableType, min_hours: hours, price_per_hour: price }])
    if (error) { alert('Error: ' + error.message); return }
    setNewTierHours(h => ({ ...h, [billableType]: '' }))
    setNewTierHoursPrice(p => ({ ...p, [billableType]: '' }))
    refreshPriceTiers()
  }

  // ── Taxi pricing defaults (Supabase) ──────────────────────────────────────
  // Most recently edited row wins (same ordering as TaxiPage, so both screens agree)
  const { data: taxiDefaultsData, loading: taxiDefaultsLoading } = useTable<TaxiPricingDefaults>('taxi_pricing_defaults', { order: 'updated_at', ascending: false })
  const [taxiPricingDefaults, setTaxiPricingDefaults] = useState<TaxiPricingDefaults | null>(null)
  const [taxiPricingForm, setTaxiPricingForm] = useState<TaxiPricingDefaults | null>(null)
  const [taxiPricingEditing, setTaxiPricingEditing] = useState(false)

  useEffect(() => {
    if (taxiDefaultsData.length > 0) {
      setTaxiPricingDefaults(taxiDefaultsData[0])
      // Not while editing: a background refetch (realtime fires on ANY change to
      // this table, including from another admin or another tab) would otherwise
      // silently overwrite whatever gui is mid-typing here. See EnquiryPanel for
      // the same bug caught live.
      setTaxiPricingForm(f => (taxiPricingEditing ? f : taxiDefaultsData[0]))
    }
  }, [taxiDefaultsData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared links (Supabase) ───────────────────────────────────────────────
  const { data: sharedLinksData, refresh: refreshSharedLinks } = useTable<SharedLink>('shared_links')
  const { data: taxiDriversData } = useTable<TaxiDriver>('taxi_drivers')
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([])
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkFormData, setLinkFormData] = useState<{ label: string; type: SharedLinkType; expires_at: string; booking_number: string; driver_id: string }>({
    label: '', type: 'forecast', expires_at: addDaysISO(todayISO(), 365), booking_number: '', driver_id: '',
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [collapsedLinkTypes, setCollapsedLinkTypes] = useState<Set<string>>(new Set())
  const toggleLinkType = (t: string) => setCollapsedLinkTypes(prev => {
    const next = new Set(prev)
    next.has(t) ? next.delete(t) : next.add(t)
    return next
  })

  // Resolve the client name behind a 'client' shared link (via its booking_number param)
  const clientNameForLink = (link: SharedLink): string | null => {
    if (link.type !== 'client') return null
    const num = parseInt(link.params?.booking_number ?? '')
    const b = allBookings.find(b => b.booking_number === num)
    return b?.client ? `${b.client.first_name} ${b.client.last_name}` : null
  }
  const presentLinkTypes = (Object.keys(LINK_TYPE_LABELS) as SharedLinkType[]).filter(t => sharedLinks.some(l => l.type === t))
  const allLinkTypesCollapsed = presentLinkTypes.length > 0 && presentLinkTypes.every(t => collapsedLinkTypes.has(t))
  const toggleAllLinkTypes = () => setCollapsedLinkTypes(allLinkTypesCollapsed ? new Set() : new Set(presentLinkTypes))

  useEffect(() => { setSharedLinks(sharedLinksData) }, [sharedLinksData])

  const filteredInstructors = instructors.filter(i =>
    `${i.first_name} ${i.last_name}`.toLowerCase().includes(searchInstructor.toLowerCase()) ||
    (i.email?.toLowerCase().includes(searchInstructor.toLowerCase())) ||
    (i.phone?.includes(searchInstructor))
  )

  const getInstructorLessons = (instructorId: string): Lesson[] =>
    lessons.filter(l => l.instructor_id === instructorId)

  // ── Instructor handlers ───────────────────────────────────────────────────

  const openInstructorForm = (instructor?: Instructor) => {
    if (instructor) {
      setInstructorFormData(instructor)
      setSelectedInstructor(instructor)
    } else {
      setInstructorFormData({ first_name: '', last_name: '', email: '', phone: '', specialties: [], rate_private: 50, rate_group: 35, rate_supervision: 25, notes: '' })
      setSelectedInstructor(null)
    }
    setShowInstructorForm(true)
  }

  const closeInstructorForm = () => { setShowInstructorForm(false); setInstructorFormData({}) }

  const handleInstructorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedInstructor) {
      const { id, ...fields } = { ...selectedInstructor, ...instructorFormData }
      const { error } = await supabase.from('instructors').update(fields).eq('id', id)
      if (error) { alert('Error: ' + error.message); return }
      setSelectedInstructor(prev => prev ? { ...prev, ...instructorFormData } : null)
    } else {
      const { error } = await supabase.from('instructors').insert([{
        first_name: instructorFormData.first_name || '',
        last_name:  instructorFormData.last_name  || '',
        email:      instructorFormData.email      || null,
        phone:      instructorFormData.phone      || null,
        specialties:     instructorFormData.specialties     || [],
        rate_private:    instructorFormData.rate_private    || 50,
        rate_group:      instructorFormData.rate_group      || 35,
        rate_supervision:instructorFormData.rate_supervision|| 25,
        notes:      instructorFormData.notes      || null,
      }])
      if (error) { alert('Error: ' + error.message); return }
    }
    refreshInstructors()
    closeInstructorForm()
  }

  const handleDeleteInstructor = async (id: string) => {
    if (confirm('Delete this instructor?')) {
      const { error } = await supabase.from('instructors').delete().eq('id', id)
      if (error) { alert('Error: ' + error.message); return }
      setSelectedInstructor(null)
      refreshInstructors()
    }
  }

  // ── Price handlers ────────────────────────────────────────────────────────

  const openPriceForm = (priceItem?: PriceItem) => {
    if (priceItem) {
      setPriceFormData(priceItem)
      setSelectedPriceCategory(priceItem.category)
    } else {
      setPriceFormData({ category: selectedPriceCategory, name: '', description: '', price: 0, unit: '' })
    }
    setShowPriceForm(true)
  }

  const closePriceForm = () => { setShowPriceForm(false); setPriceFormData({}) }

  /** Billable posts of a category that no rate row covers — they bill 0 today. */
  const missingRates = (category: PriceCategory): string[] =>
    (CATEGORY_BILLABLES[category] ?? [])
      .filter(t => !priceItems.some(p => p.billable_type === t))
      .map(t => BILLABLE_LABELS[t])

  /** Posts still free to claim, so the picker can never create a duplicate the
   *  unique index would reject. A row keeps its own post when editing. */
  const availableBillables = (category: PriceCategory, current: BillableType | null | undefined) =>
    (CATEGORY_BILLABLES[category] ?? [])
      .filter(t => t === current || !priceItems.some(p => p.billable_type === t))

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (priceFormData.id) {
      const { id, ...fields } = priceFormData as PriceItem
      const { error } = await supabase.from('price_items').update(fields).eq('id', id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('price_items').insert([{
        category:    priceFormData.category    || selectedPriceCategory,
        name:        priceFormData.name        || '',
        description: priceFormData.description || null,
        price:       priceFormData.price       || 0,
        unit:        priceFormData.unit        || null,
        billable_type: priceFormData.billable_type ?? null,
      }])
      if (error) { alert('Error: ' + error.message); return }
    }
    refreshPriceItems()
    closePriceForm()
  }

  const handleDeletePrice = async (id: string) => {
    if (confirm('Delete this price entry?')) {
      const { error } = await supabase.from('price_items').delete().eq('id', id)
      if (error) { alert('Error: ' + error.message); return }
      refreshPriceItems()
    }
  }

  // ── Shared link handlers ──────────────────────────────────────────────────

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    const params: Record<string, string> = {}
    if (linkFormData.type === 'client' && linkFormData.booking_number)
      params.booking_number = linkFormData.booking_number
    if (linkFormData.type === 'driver' && linkFormData.driver_id)
      params.driver_id = linkFormData.driver_id

    // Default label: for a driver link, include the driver name so links are distinguishable.
    const driverName = taxiDriversData.find(d => d.id === linkFormData.driver_id)?.name
    const defaultLabel = linkFormData.type === 'driver' && driverName
      ? `Driver – ${driverName}`
      : LINK_TYPE_LABELS[linkFormData.type].label

    const { error } = await supabase.from('shared_links').insert([{
      token:      generateToken(linkFormData.type),
      type:       linkFormData.type,
      label:      linkFormData.label || defaultLabel,
      params,
      created_at: todayISO(),
      expires_at: linkFormData.expires_at || null,
      is_active:  true,
    }])
    if (error) { alert('Error: ' + error.message); return }
    refreshSharedLinks()
    setShowLinkForm(false)
    setLinkFormData({ label: '', type: 'forecast', expires_at: addDaysISO(todayISO(), 365), booking_number: '', driver_id: '' })
  }

  const toggleLinkActive = async (id: string) => {
    const link = sharedLinks.find(l => l.id === id)
    if (!link) return
    const { error } = await supabase.from('shared_links').update({ is_active: !link.is_active }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    refreshSharedLinks()
  }

  const deleteLink = async (id: string) => {
    if (confirm('Delete this link? Anyone using it will lose access.')) {
      const { error } = await supabase.from('shared_links').delete().eq('id', id)
      if (error) { alert('Error: ' + error.message); return }
      refreshSharedLinks()
    }
  }

  const copyLink = (token: string, id: string) => {
    const url = `${getBaseUrl()}/?share=${token}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200">Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage instructors, pricing, and shared links</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 md:gap-4 mt-4 md:mt-8 mb-4 md:mb-8 border-b overflow-x-auto">
          {(['instructors', 'houses', 'pricing', 'seasons', 'sources', 'agencies', 'links', 'bookguest', 'database'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 md:px-4 md:py-2 text-sm md:text-base font-medium capitalize transition-colors ${
                tab === t ? 'border-b-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              {t === 'instructors' ? '📚 Instructors'
                : t === 'houses'   ? '🏠 Accommodations'
                : t === 'pricing'  ? '💰 Pricing'
                : t === 'seasons'  ? '📆 Seasons'
                : t === 'sources'  ? '📣 Sources'
                : t === 'agencies' ? '🤝 Agencies'
                : t === 'links'    ? <>🔗 <span className="hidden sm:inline">Shared </span>Links</>
                : t === 'database' ? '🗄️ Database'
                : <>👥 Bookings<span className="hidden sm:inline"> & Guests</span></>}
            </button>
          ))}
        </div>

        {/* ── Instructors Tab ────────────────────────────────────────────────── */}
        {tab === 'instructors' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Instructors</h2>
                <button onClick={() => openInstructorForm()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
                  + New instructor
                </button>
              </div>
              <div className="mb-6">
                <input type="text" placeholder="Search by name, email or phone…"
                  value={searchInstructor} onChange={(e) => setSearchInstructor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-100 dark:bg-gray-800 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Specialties</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Pay · private €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Pay · group €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Pay · supervision €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstructors.map((instructor) => (
                      <tr key={instructor.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => { setSelectedInstructor(instructor); setInstructorDetailTab('info') }}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{instructor.first_name} {instructor.last_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{instructor.specialties.length > 0 ? instructor.specialties.join(', ') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{instructor.rate_private}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{instructor.rate_group}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{instructor.rate_supervision}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{instructor.email || '-'}</td>
                        <td className="px-4 py-3 text-sm space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openInstructorForm(instructor)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400 font-medium">✏️</button>
                          <button onClick={() => handleDeleteInstructor(instructor.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-400 font-medium">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-4">
                {filteredInstructors.map((instructor) => (
                  <div key={instructor.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 cursor-pointer"
                    onClick={() => { setSelectedInstructor(instructor); setInstructorDetailTab('info') }}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-200">{instructor.first_name} {instructor.last_name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{instructor.email || '-'}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                      <p>💰 Pay · private: {instructor.rate_private}€/h</p>
                      <p>👥 Pay · group: {instructor.rate_group}€/h</p>
                      <p>🎓 Pay · supervision: {instructor.rate_supervision}€/h</p>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openInstructorForm(instructor)}
                        className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium text-sm hover:bg-blue-200 dark:hover:bg-blue-800">✏️ Edit</button>
                      <button onClick={() => handleDeleteInstructor(instructor.id)}
                        className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded font-medium text-sm hover:bg-red-200 dark:hover:bg-red-800">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            {selectedInstructor && (
              <div className="xl:col-span-1">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow sticky top-24 max-h-[calc(100vh-150px)] overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">{selectedInstructor.first_name} {selectedInstructor.last_name}</h2>
                      <p className="text-blue-100 dark:text-blue-300 text-sm mt-1">{selectedInstructor.phone || '-'}</p>
                    </div>
                    <button onClick={() => setSelectedInstructor(null)}
                      className="text-2xl text-white hover:text-blue-100 dark:hover:text-blue-300 font-bold w-8 h-8 flex items-center justify-center flex-shrink-0">✕</button>
                  </div>
                  <div className="border-b flex">
                    {(['info', 'lessons'] as const).map(t => (
                      <button key={t} onClick={() => setInstructorDetailTab(t)}
                        className={`flex-1 py-3 px-4 font-medium text-sm capitalize transition-colors ${
                          instructorDetailTab === t ? 'border-b-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}>
                        {t === 'info' ? 'Info' : 'Lessons'}
                      </button>
                    ))}
                  </div>
                  {instructorDetailTab === 'info' && (
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">First name</p><p className="text-gray-800 dark:text-gray-200">{selectedInstructor.first_name}</p></div>
                      <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last name</p><p className="text-gray-800 dark:text-gray-200">{selectedInstructor.last_name}</p></div>
                      <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</p><p className="text-gray-800 dark:text-gray-200">{selectedInstructor.email || '-'}</p></div>
                      <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</p><p className="text-gray-800 dark:text-gray-200">{selectedInstructor.phone || '-'}</p></div>
                      <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Specialties</p><p className="text-gray-800 dark:text-gray-200">{selectedInstructor.specialties.length > 0 ? selectedInstructor.specialties.join(', ') : '-'}</p></div>
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pay rates <span className="font-normal text-gray-400 dark:text-gray-400">— what the centre pays, not what the client is billed</span></p>
                        <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1 mt-2">
                          <p>Private: {selectedInstructor.rate_private}€/h</p>
                          <p>Group: {selectedInstructor.rate_group}€/h</p>
                          <p>Supervision: {selectedInstructor.rate_supervision}€/h</p>
                        </div>
                      </div>
                      <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</p><p className="text-gray-800 dark:text-gray-200">{selectedInstructor.notes || '-'}</p></div>
                      <button onClick={() => openInstructorForm(selectedInstructor)}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">✏️ Edit</button>
                    </div>
                  )}
                  {instructorDetailTab === 'lessons' && (
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      {getInstructorLessons(selectedInstructor.id).length === 0 ? (
                        <p className="text-gray-600 dark:text-gray-400 text-sm">No lessons</p>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {getInstructorLessons(selectedInstructor.id).map((lesson) => (
                            <div key={lesson.id} className="border rounded-lg p-3 text-sm">
                              <div className="font-medium text-gray-800 dark:text-gray-200 mb-2">{fmtDate(lesson.date)} at {lesson.start_time}</div>
                              <div className="text-gray-600 dark:text-gray-400 space-y-1">
                                <p>Type: {lesson.type === 'private' ? 'Private' : lesson.type === 'group' ? 'Group' : 'Supervision'}</p>
                                <p>Duration: {lesson.duration_hours}h</p>
                                {lesson.notes && <p>Notes: {lesson.notes}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Houses Tab ────────────────────────────────────────────────────── */}
        {tab === 'houses' && <AccommodationsTab />}

        {/* ── Seasons Tab ───────────────────────────────────────────────────── */}
        {tab === 'seasons' && <SeasonsTab />}

        {/* ── Enquiry sources Tab ───────────────────────────────────────────── */}
        {tab === 'sources' && <SourcesTab />}

        {/* ── Agencies Tab ──────────────────────────────────────────────────── */}
        {tab === 'agencies' && <AgenciesTab />}

        {/* ── Pricing Tab ───────────────────────────────────────────────────── */}
        {tab === 'pricing' && (
          <div className="space-y-6">
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800">
              {([['rates', 'Rates'], ['reference', 'Reference info']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setPricingSubTab(key)}
                  className={`pb-2 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    pricingSubTab === key
                      ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>

            {pricingSubTab === 'reference' && <TransferReferencePricesTab />}

            {pricingSubTab === 'rates' && (
            <div className="space-y-8">
            {/* Generic categories: lesson, activity, rental */}
            {(['lesson', 'rental', 'meal', 'center_access', 'activity'] as const).map((category) => {
              const categoryPrices = priceItems.filter(p => p.category === category)
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{priceCategoryLabels[category]}</h2>
                    <button onClick={() => { setSelectedPriceCategory(category); openPriceForm() }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm">
                      + Add
                    </button>
                  </div>
                  {categoryPrices.length === 0 && missingRates(category).length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">No price entries</p>
                  ) : (
                    <>
                    <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead className="bg-gray-100 dark:bg-gray-800 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Price</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Unit</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryPrices.map((price) => {
                            const bills = billedBy(price)
                            return (
                            <tr key={price.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                                {price.name}
                                {bills && (
                                  <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded px-1.5 py-0.5 whitespace-nowrap"
                                    title="This rate is what the app bills. Its name is a label only — you can change the price, not what it applies to.">
                                    🔒 bills {bills}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{price.description || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 font-medium">{price.price}€</td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{price.unit || '-'}</td>
                              <td className="px-4 py-3 text-sm space-x-2 whitespace-nowrap">
                                <button onClick={() => openPriceForm(price)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400 font-medium">✏️</button>
                                {bills ? (
                                  // opacity, not a text colour: the bin is an emoji and keeps its own colours
                                  <span className="opacity-25 cursor-not-allowed grayscale" title="Cannot be deleted: the app bills with it. Set its price to 0 if you stop charging for it.">🗑️</span>
                                ) : (
                                  <button onClick={() => handleDeletePrice(price.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-400 font-medium">🗑️</button>
                                )}
                              </td>
                            </tr>
                          )})}
                          {/* A billable type with no rate is billed 0 — say so rather than let it pass */}
                          {missingRates(category).map(label => (
                            <tr key={label} className="border-b bg-red-50 dark:bg-red-950/40">
                              <td className="px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400" colSpan={4}>
                                ⚠️ {label} — no rate configured, billed 0€
                              </td>
                              <td className="px-4 py-3 text-sm text-red-400 dark:text-red-300">—</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: cards instead of a cramped wide table */}
                    <div className="md:hidden space-y-3">
                      {categoryPrices.map((price) => {
                        const bills = billedBy(price)
                        return (
                          <div key={price.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <p className="font-bold text-gray-800 dark:text-gray-200">{price.name}</p>
                              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{price.price}€</p>
                            </div>
                            {bills && (
                              <span className="inline-block mb-2 text-xs font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded px-1.5 py-0.5"
                                title="This rate is what the app bills. Its name is a label only — you can change the price, not what it applies to.">
                                🔒 bills {bills}
                              </span>
                            )}
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5 mb-3">
                              {price.description && <p>{price.description}</p>}
                              {price.unit && <p>Unit: {price.unit}</p>}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => openPriceForm(price)} className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium text-sm hover:bg-blue-200 dark:hover:bg-blue-800">
                                ✏️ Edit
                              </button>
                              {bills ? (
                                <span className="flex-1 px-3 py-2 text-center rounded font-medium text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                                  title="Cannot be deleted: the app bills with it. Set its price to 0 if you stop charging for it.">
                                  🗑️ Delete
                                </span>
                              ) : (
                                <button onClick={() => handleDeletePrice(price.id)} className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded font-medium text-sm hover:bg-red-200 dark:hover:bg-red-800">
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {missingRates(category).map(label => (
                        <div key={label} className="bg-red-50 dark:bg-red-950/40 rounded-lg shadow p-4 text-sm font-medium text-red-700 dark:text-red-400">
                          ⚠️ {label} — no rate configured, billed 0€
                        </div>
                      ))}
                    </div>
                    </>
                  )}

                  {/* Volume tiers — private/group lessons only. The base rate
                      above stays the implicit "0h+" step; a row here is one
                      threshold above it. Add-only for now (deactivate/remove
                      later if gui asks once he's tried it). */}
                  {category === 'lesson' && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 select-none">
                        🎚️ Volume tiers
                      </summary>
                      <div className="mt-4 space-y-4">
                      {(['lesson_private', 'lesson_group'] as const).map(billableType => {
                        const tiersForType = priceTiers
                          .filter(t => t.billable_type === billableType)
                          .sort((a, b) => a.min_hours - b.min_hours)
                        return (
                          <div key={billableType} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                              🎚️ Volume tiers — {BILLABLE_LABELS[billableType]}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-400 mb-3">
                              Cumulative hours count across the client's entire history, never reset per
                              stay or season. Below the first tier, the base rate above applies.
                            </p>
                            {tiersForType.length > 0 && (
                              <div className="space-y-1 mb-3">
                                {tiersForType.map(t => (
                                  <p key={t.id} className="text-sm text-gray-700 dark:text-gray-300">
                                    {t.min_hours}h+ → <span className="font-medium">{t.price_per_hour}€/h</span>
                                  </p>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap items-end gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From (hours)</label>
                                <input type="number" min="0" step="0.5" placeholder="e.g. 10"
                                  value={newTierHours[billableType] ?? ''}
                                  onChange={e => setNewTierHours(h => ({ ...h, [billableType]: e.target.value }))}
                                  className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price (€/h)</label>
                                <input type="number" min="0" step="0.5" placeholder="e.g. 25"
                                  value={newTierPrice[billableType] ?? ''}
                                  onChange={e => setNewTierHoursPrice(p => ({ ...p, [billableType]: e.target.value }))}
                                  className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
                              </div>
                              <button onClick={() => handleAddTier(billableType)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
                                + Add tier
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      </div>
                    </details>
                  )}
                </div>
              )
            })}

            {/* Taxi Pricing Defaults */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">🚕 Taxi Pricing Defaults</h2>
                {taxiPricingDefaults && !taxiPricingEditing && (
                  <button onClick={() => { setTaxiPricingForm({ ...taxiPricingDefaults }); setTaxiPricingEditing(true) }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm">
                    ✏️ Edit
                  </button>
                )}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                {taxiDefaultsLoading ? (
                  <p className="text-sm text-gray-400 dark:text-gray-400">Loading…</p>
                ) : !taxiPricingDefaults ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No taxi pricing defaults found.</p>
                    <button onClick={async () => {
                      const defaults = { default_price_eur: 120, default_driver_mzn: 6000, default_manager_mzn: 1000, eur_mzn_rate: 65.0, updated_at: new Date().toISOString() }
                      const { data, error } = await supabase.from('taxi_pricing_defaults').insert([defaults]).select().single()
                      if (error) { alert('Error: ' + error.message); return }
                      setTaxiPricingDefaults(data)
                      setTaxiPricingForm(data)
                    }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
                      Initialize defaults
                    </button>
                  </div>
                ) : taxiPricingEditing && taxiPricingForm ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client price (EUR)</label>
                        <input type="number" min="0" value={taxiPricingForm.default_price_eur}
                          onChange={e => setTaxiPricingForm(f => f ? ({ ...f, default_price_eur: parseInt(e.target.value) || 0 }) : f)}
                          className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-blue-900 dark:text-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Driver payment (MZN)</label>
                        <input type="number" min="0" value={taxiPricingForm.default_driver_mzn}
                          onChange={e => setTaxiPricingForm(f => f ? ({ ...f, default_driver_mzn: parseInt(e.target.value) || 0 }) : f)}
                          className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-amber-900 dark:text-amber-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Manager commission (MZN)</label>
                        <input type="number" min="0" value={taxiPricingForm.default_manager_mzn}
                          onChange={e => setTaxiPricingForm(f => f ? ({ ...f, default_manager_mzn: parseInt(e.target.value) || 0 }) : f)}
                          className="w-full text-sm border rounded px-2 py-1.5 font-semibold text-purple-900 dark:text-purple-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">EUR/MZN rate</label>
                        <input type="number" min="1" step="0.01" value={taxiPricingForm.eur_mzn_rate}
                          onChange={e => setTaxiPricingForm(f => f ? ({ ...f, eur_mzn_rate: parseFloat(e.target.value) || 65 }) : f)}
                          className="w-full text-sm border rounded px-2 py-1.5" />
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded p-3 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">MZN cost total: </span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {taxiPricingForm.default_driver_mzn + taxiPricingForm.default_manager_mzn} MZN
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 ml-3">
                        ≈ {Math.round((taxiPricingForm.default_driver_mzn + taxiPricingForm.default_manager_mzn) / taxiPricingForm.eur_mzn_rate)}€
                      </span>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setTaxiPricingEditing(false)}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm">Cancel</button>
                      <button onClick={async () => {
                        if (!taxiPricingForm) return
                        const updated = { ...taxiPricingForm, updated_at: new Date().toISOString() }
                        const { error } = await supabase.from('taxi_pricing_defaults').update({
                          default_price_eur:  updated.default_price_eur,
                          default_driver_mzn: updated.default_driver_mzn,
                          default_manager_mzn:updated.default_manager_mzn,
                          eur_mzn_rate:       updated.eur_mzn_rate,
                          updated_at:         updated.updated_at,
                        }).eq('id', updated.id)
                        if (error) { alert('Error: ' + error.message); return }
                        setTaxiPricingDefaults(updated)
                        setTaxiPricingEditing(false)
                      }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950/40 rounded p-3">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Client price</p>
                      <p className="text-xl font-bold text-blue-900 dark:text-blue-400">{taxiPricingDefaults.default_price_eur}€</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/40 rounded p-3">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Driver payment</p>
                      <p className="text-xl font-bold text-amber-900 dark:text-amber-400">{taxiPricingDefaults.default_driver_mzn.toLocaleString()} MZN</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/40 rounded p-3">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Manager commission</p>
                      <p className="text-xl font-bold text-purple-900 dark:text-purple-400">{taxiPricingDefaults.default_manager_mzn.toLocaleString()} MZN</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">EUR/MZN rate</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">1€ = {taxiPricingDefaults.eur_mzn_rate} MZN</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
            )}
          </div>
        )}

        {/* ── Shared Links Tab ──────────────────────────────────────────────── */}
        {/* ── Bookings & Guests Tab ─────────────────────────────────────── */}
        {tab === 'bookguest' && (() => {
          const today = todayISO()
          const activeNow   = allBookings.filter(b => b.check_in <= today && b.check_out >= today && b.status !== 'cancelled').length
          const upcomingCnt = allBookings.filter(b => b.check_in > today && b.status !== 'cancelled').length
          const confirmedCnt = allBookings.filter(b => b.status === 'confirmed').length

          const filtered = allBookings
            .filter(b => {
              if (bgTimeFilter === 'active')   return b.check_in <= today && b.check_out >= today
              if (bgTimeFilter === 'upcoming') return b.check_in > today
              if (bgTimeFilter === 'past')     return b.check_out < today
              return true
            })
            .filter(b => !bgStatusFilter || b.status === bgStatusFilter)
            .filter(b => {
              if (!bgSearch) return true
              const s = bgSearch.toLowerCase()
              const name = `${b.client?.first_name ?? ''} ${b.client?.last_name ?? ''}`.toLowerCase()
              return name.includes(s) || String(b.booking_number).padStart(3, '0').includes(bgSearch) || `#${b.booking_number}`.includes(bgSearch)
            })

          return (
            <div>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeNow}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Active now</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{upcomingCnt}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Upcoming</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{confirmedCnt}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Confirmed total</div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4 items-center">
                <input
                  type="text"
                  value={bgSearch}
                  onChange={e => setBgSearch(e.target.value)}
                  placeholder="Search name or #booking…"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                />
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  {(['all', 'active', 'upcoming', 'past'] as const).map(f => (
                    <button key={f} onClick={() => setBgTimeFilter(f)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${bgTimeFilter === f ? 'bg-white dark:bg-gray-900 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                      {f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'upcoming' ? 'Upcoming' : 'Past'}
                    </button>
                  ))}
                </div>
                <select value={bgStatusFilter} onChange={e => setBgStatusFilter(e.target.value as '' | BookingStatus)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="provisional">Provisional</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <span className="text-sm text-gray-400 dark:text-gray-400 ml-auto">{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</span>
              </div>

              {/* List */}
              {filtered.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No bookings match these filters.</p>
              ) : (
                <div className="space-y-2">
                  {filtered.map(b => {
                    const guests = allParticipants.filter(p => p.booking_id === b.id)
                    const isOpen = bgOpenId === b.id
                    return (
                      <div key={b.id} className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                        <button
                          className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => setBgOpenId(isOpen ? null : b.id)}
                        >
                          <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">#{String(b.booking_number).padStart(3, '0')}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{b.client?.first_name} {b.client?.last_name}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                          <span className="text-sm text-gray-400 dark:text-gray-400 ml-auto flex items-center gap-1">
                            {guests.length} guest{guests.length !== 1 ? 's' : ''}
                            <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
                          </span>
                        </button>
                        {isOpen && (
                          <div className="border-t px-4 py-3 bg-gray-50 dark:bg-gray-800">
                            {guests.length === 0 ? (
                              <p className="text-sm text-gray-400 dark:text-gray-400">No guests listed.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {guests.map(p => (
                                  <div key={p.id} className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm text-gray-800 dark:text-gray-200">{p.first_name} {p.last_name ?? ''}</span>
                                    {p.kite_level && (
                                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${KITE_LEVEL_COLORS[p.kite_level]}`}>
                                        {KITE_LEVEL_LABELS[p.kite_level]}
                                      </span>
                                    )}
                                    {p.passport_number && <span className="text-xs text-gray-400 dark:text-gray-400">{p.passport_number}</span>}
                                    {p.notes && <span className="text-xs text-gray-400 dark:text-gray-400 italic">{p.notes}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-3 pt-2 border-t flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                              {b.num_lessons > 0 && <span>🏄 {b.num_lessons} lesson{b.num_lessons !== 1 ? 's' : ''}</span>}
                              {b.num_equipment_rentals > 0 && <span>🪁 {b.num_equipment_rentals} rental{b.num_equipment_rentals !== 1 ? 's' : ''}</span>}
                              {b.num_wing_lessons > 0 && <span>🪽 {b.num_wing_lessons} wing</span>}
                              {b.num_center_access > 0 && <span>🏖 {b.num_center_access} center access</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {tab === 'links' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Shared Links</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Generate read-only public links to share with clients or providers.</p>
              </div>
              <button onClick={() => setShowLinkForm(v => !v)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
                + New link
              </button>
            </div>

            {/* Create form */}
            {showLinkForm && (
              <form onSubmit={handleCreateLink} className="bg-white dark:bg-gray-900 rounded-lg shadow p-5 mb-6 max-w-lg space-y-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-200">New shared link</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select value={linkFormData.type}
                    onChange={e => setLinkFormData(d => ({ ...d, type: e.target.value as SharedLinkType }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {(Object.entries(LINK_TYPE_LABELS) as [SharedLinkType, { icon: string; label: string }][]).filter(([k]) => k !== 'activity_provider').map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                {linkFormData.type === 'client' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Find by client name</label>
                      <select value={linkFormData.booking_number}
                        onChange={e => setLinkFormData(d => ({ ...d, booking_number: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">— Select a booking —</option>
                        {[...allBookings]
                          .sort((a, b) => `${a.client?.last_name ?? ''}${a.client?.first_name ?? ''}`.localeCompare(`${b.client?.last_name ?? ''}${b.client?.first_name ?? ''}`))
                          .map(b => (
                            <option key={b.id} value={b.booking_number}>
                              {b.client ? `${b.client.first_name} ${b.client.last_name}` : 'Unknown'} — #{String(b.booking_number).padStart(3, '0')} ({fmtDate(b.check_in)} → {fmtDate(b.check_out)})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">…or booking number *</label>
                      <input type="number" min="1" value={linkFormData.booking_number}
                        onChange={e => setLinkFormData(d => ({ ...d, booking_number: e.target.value }))}
                        placeholder="e.g. 42"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                )}
                {linkFormData.type === 'driver' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Driver *</label>
                    <select value={linkFormData.driver_id}
                      onChange={e => setLinkFormData(d => ({ ...d, driver_id: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900">
                      <option value="">— Select a driver —</option>
                      {taxiDriversData.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label (optional)</label>
                  <input type="text" value={linkFormData.label}
                    onChange={e => setLinkFormData(d => ({ ...d, label: e.target.value }))}
                    placeholder={`e.g. Forecast – Week 9`}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires on (optional)</label>
                  <input type="date" value={linkFormData.expires_at}
                    onChange={e => setLinkFormData(d => ({ ...d, expires_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowLinkForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm">Cancel</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">Generate</button>
                </div>
              </form>
            )}

            {/* Links list — grouped by type, collapsible */}
            {sharedLinks.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No shared links yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button onClick={toggleAllLinkTypes}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    {allLinkTypesCollapsed ? '▼ Expand all' : '▲ Collapse all'}
                  </button>
                </div>
                {(Object.keys(LINK_TYPE_LABELS) as SharedLinkType[])
                  .map(type => ({ type, links: sharedLinks.filter(l => l.type === type) }))
                  .filter(g => g.links.length > 0)
                  .map(({ type, links }) => {
                    const info = LINK_TYPE_LABELS[type]
                    const isOpen = !collapsedLinkTypes.has(type)
                    return (
                      <div key={type} className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                        <button onClick={() => toggleLinkType(type)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <span className="text-base">{info.icon}</span>
                            {info.label}
                            <span className="text-xs font-normal text-gray-400 dark:text-gray-400">({links.length})</span>
                          </span>
                          <span className="text-gray-400 dark:text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                          <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                            {links.map(link => {
                              const url = `${getBaseUrl()}/?share=${link.token}`
                              const clientName = clientNameForLink(link)
                              // Expiry is enforced at the RLS level regardless of is_active — a
                              // link past its date already serves nothing. Surfaced here too, or
                              // this list would keep calling it "Active" until someone notices
                              // the link stopped working.
                              const isExpired = !!link.expires_at && link.expires_at < todayISO()
                              return (
                                <div key={link.id} className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${(!link.is_active || isExpired) ? 'opacity-60' : ''}`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="font-semibold text-gray-800 dark:text-gray-200">{link.label}</span>
                                      {clientName && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-medium">👤 {clientName}</span>
                                      )}
                                      {isExpired ? (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                          ⏰ Expired
                                        </span>
                                      ) : (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${link.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                          {link.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-400 truncate font-mono">{url}</div>
                                    <div className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                                      Created {link.created_at}
                                      {link.expires_at && (
                                        <span className={isExpired ? 'text-red-500 dark:text-red-400 font-medium' : ''}>
                                          {` · ${isExpired ? 'Expired' : 'Expires'} ${link.expires_at}`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => copyLink(link.token, link.id)}
                                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                        copiedId === link.id
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      {copiedId === link.id ? '✓ Copied!' : '📋 Copy'}
                                    </button>
                                    <button
                                      onClick={() => toggleLinkActive(link.id)}
                                      className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                                    >
                                      {link.is_active ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                      onClick={() => deleteLink(link.id)}
                                      className="px-3 py-1.5 rounded text-sm font-medium bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 transition-colors"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {tab === 'database' && <DatabaseTab />}
      </div>

      {/* ── Instructor form modal ─────────────────────────────────────────── */}
      {showInstructorForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{selectedInstructor ? 'Edit instructor' : 'New instructor'}</h2>
              <button onClick={closeInstructorForm} className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handleInstructorSubmit} className="space-y-4 flex flex-col h-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First name *</label>
                    <input type="text" value={instructorFormData.first_name || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last name *</label>
                    <input type="text" value={instructorFormData.last_name || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input type="email" value={instructorFormData.email || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, email: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                    <input type="tel" value={instructorFormData.phone || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, phone: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Specialties</label>
                  <div className="space-y-2">
                    {specialtyOptions.map((label, idx) => (
                      <label key={idx} className="flex items-center">
                        <input type="checkbox"
                          checked={(instructorFormData.specialties || []).includes(specialtyValues[idx])}
                          onChange={(e) => {
                            const cur = instructorFormData.specialties || []
                            setInstructorFormData({ ...instructorFormData, specialties: e.target.checked ? [...cur, specialtyValues[idx]] : cur.filter(s => s !== specialtyValues[idx]) })
                          }}
                          className="w-4 h-4 rounded" />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mb-2">
                  What this instructor <strong>earns</strong> per hour — 0 is fine for an owner
                  teaching their own guests. What the client pays is set in the Pricing tab.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pay · private €/h</label>
                    <input type="number" value={instructorFormData.rate_private || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_private: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pay · group €/h</label>
                    <input type="number" value={instructorFormData.rate_group || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_group: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pay · supervision €/h</label>
                    <input type="number" value={instructorFormData.rate_supervision || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_supervision: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={instructorFormData.notes || ''}
                    onChange={(e) => setInstructorFormData({ ...instructorFormData, notes: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
                </div>
                <div className="flex gap-3 pt-4 border-t mt-auto">
                  <button type="button" onClick={closeInstructorForm}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium">Cancel</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Price form modal ──────────────────────────────────────────────── */}
      {showPriceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{priceFormData.id ? 'Edit price' : 'New price'}</h2>
              <button onClick={closePriceForm} className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handlePriceSubmit} className="space-y-4 flex flex-col h-full">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input type="text" value={priceFormData.name || ''}
                    onChange={(e) => setPriceFormData({ ...priceFormData, name: e.target.value })}
                    readOnly={!!billedBy(priceFormData as PriceItem)}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      billedBy(priceFormData as PriceItem) ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed' : ''
                    }`} />
                  {billedBy(priceFormData as PriceItem) && (
                    <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                      🔒 Locked: this rate bills {billedBy(priceFormData as PriceItem)}. The name is a label only —
                      what it applies to is set below and cannot change. Edit the price freely.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <input type="text" value={priceFormData.description || ''}
                    onChange={(e) => setPriceFormData({ ...priceFormData, description: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price *</label>
                    <input type="number" value={priceFormData.price || ''}
                      onChange={(e) => setPriceFormData({ ...priceFormData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                    <input type="text" value={priceFormData.unit || ''}
                      onChange={(e) => setPriceFormData({ ...priceFormData, unit: e.target.value || null })}
                      placeholder="e.g. / day"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                {(CATEGORY_BILLABLES[priceFormData.category || selectedPriceCategory] ?? []).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Applies to *</label>
                    <select value={priceFormData.billable_type ?? ''}
                      disabled={!!priceFormData.billable_type}
                      onChange={(e) => setPriceFormData({ ...priceFormData, billable_type: (e.target.value || null) as BillableType | null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400">
                      <option value="">— not billed —</option>
                      {availableBillables(priceFormData.category || selectedPriceCategory, priceFormData.billable_type).map(t => (
                        <option key={t} value={t}>{BILLABLE_LABELS[t]}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                      {priceFormData.billable_type
                        ? '🔒 Locked once set — moving a rate to another post would reprice past work silently.'
                        : 'Links this rate to what it bills. Without it, that post is billed 0. One rate per post.'}
                    </p>
                  </div>
                )}
                <div className="flex gap-3 pt-4 border-t mt-auto">
                  <button type="button" onClick={closePriceForm}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium">Cancel</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
