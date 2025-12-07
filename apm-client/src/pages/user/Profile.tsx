// src/pages/user/Profile.tsx
// Desktop-First Profile Page Following Keka HR Design

import React, { useState, useRef, useEffect, useCallback, memo } from 'react'

import { motion } from 'framer-motion'
import {
  UserIcon,
  PencilIcon,
  MapPinIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  LinkIcon,
  ShieldCheckIcon,
  CalendarIcon,
  IdentificationIcon,
  CameraIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  ClockIcon,
  XCircleIcon,
  BuildingOfficeIcon,
  HomeIcon,
  PlusIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  ArrowUpTrayIcon,
  LockClosedIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline'
import {
  CheckBadgeIcon as CheckBadgeIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
} from '@heroicons/react/24/solid'

import {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useDeleteProfilePictureMutation,
  useGetMembershipStatusQuery,
  useGetAddressesQuery,
  useUpdateAddressMutation,
  useGetEducationHistoryQuery,
  useAddEducationMutation,
  useUpdateEducationMutation,
  useDeleteEducationMutation,
  useGetWorkHistoryQuery,
  useAddWorkExperienceMutation,
  useUpdateWorkExperienceMutation,
  useDeleteWorkExperienceMutation,
} from '../../store/api/userApi'
import { useAuth } from '../../hooks/useAuth'
import AlumniIdentityCard from '../../components/common/UI/AlumniIdentityCard'


interface Address {
  id: string
  addressType: 'PERMANENT' | 'CURRENT'
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
}

// Simple memoized textarea to prevent re-renders
// Simple display component for non-editing fields
const SimpleFieldDisplay = ({
  label,
  value,
}: {
  label: string
  value: any
}) => (
  <div>
    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
      {label}
    </dt>
    <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
      {value?.toString() || 'Not Set'}
    </dd>
  </div>
)

// Simple Textarea Field - No extra hooks to avoid React violations
const SimpleTextareaField = memo(
  ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }) => {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
      </div>
    )
  }
)

// Field Display Component - Memoized to prevent re-creation
const FieldDisplay = memo<{
  label: string
  value: string | number | boolean | null
  isEditing?: boolean
  fieldKey?: string
  type?: 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  placeholder?: string
  sectionData: any
  onFieldChange: (field: string, value: any) => void
}>(
  ({
    label,
    value,
    isEditing = false,
    fieldKey = '',
    type = 'text',
    options,
    placeholder,
    sectionData,
    onFieldChange,
  }) => {
    const displayValue = value?.toString() || 'Not Set'

    if (isEditing && fieldKey) {
      const currentValue = sectionData[fieldKey] ?? value ?? ''

      if (type === 'textarea') {
        return (
          <SimpleTextareaField
            label={label}
            value={currentValue || ''}
            onChange={(newValue) => onFieldChange(fieldKey, newValue)}
            placeholder={placeholder}
          />
        )
      }

      if (type === 'select' && options) {
        return (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </label>
            <select
              value={currentValue}
              onChange={(e) => onFieldChange(fieldKey, e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )
      }

      if (type === 'checkbox') {
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={Boolean(currentValue)}
              onChange={(e) => onFieldChange(fieldKey, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </label>
          </div>
        )
      }

      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
          <input
            type={type}
            value={currentValue}
            onChange={(e) => onFieldChange(fieldKey, e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
        </div>
      )
    }

    return (
      <div>
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </dt>
        <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
          {type === 'checkbox' ? (Boolean(value) ? 'Yes' : 'No') : displayValue}
        </dd>
      </div>
    )
  }
)

// SectionCard Component - Outside Profile to prevent re-creation and focus loss
const SectionCard = memo<{
  title: string
  sectionKey: string
  children: React.ReactNode
  canEdit?: boolean
  editingSection: string | null
  onEditSection: (key: string) => void
  onSaveSection: (key: string) => void
  onCancelEdit: () => void
}>(({ title, sectionKey, children, canEdit = true, editingSection, onEditSection, onSaveSection, onCancelEdit }) => {
  const isEditing = editingSection === sectionKey

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => onSaveSection(sectionKey)}
                  className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                >
                  <CheckBadgeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  Save
                </button>
                <button
                  onClick={onCancelEdit}
                  className="inline-flex items-center px-3 py-1.5 bg-gray-500 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-gray-600 transition-colors"
                >
                  <XCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => onEditSection(sectionKey)}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                <PencilIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                Edit
              </button>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">
            <LockClosedIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
            Locked
          </div>
        )}
      </div>
      {children}
    </div>
  )
})

// Indian States and Districts data
const INDIAN_STATES = [
  { name: 'Andhra Pradesh', districts: ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool', 'Prakasam', 'Nellore', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'] },
  { name: 'Arunachal Pradesh', districts: ['Tawang', 'West Kameng', 'East Kameng', 'Papum Pare', 'Kurung Kumey', 'Kra Daadi', 'Lower Subansiri', 'Upper Subansiri', 'West Siang', 'East Siang', 'Siang', 'Upper Siang', 'Lower Siang', 'Lower Dibang Valley', 'Dibang Valley', 'Anjaw', 'Lohit', 'Namsai', 'Changlang', 'Tirap', 'Longding'] },
  { name: 'Assam', districts: ['Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup Metropolitan', 'Kamrup', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Dima Hasao', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'] },
  { name: 'Bihar', districts: ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'] },
  { name: 'Chhattisgarh', districts: ['Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Korba', 'Korea', 'Mahasamund', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sukma', 'Surajpur', 'Surguja'] },
  { name: 'Goa', districts: ['North Goa', 'South Goa'] },
  { name: 'Gujarat', districts: ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udepur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kachchh', 'Kheda', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'] },
  { name: 'Haryana', districts: ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'] },
  { name: 'Himachal Pradesh', districts: ['Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'] },
  { name: 'Jharkhand', districts: ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela-Kharsawan', 'Simdega', 'West Singhbhum'] },
  { name: 'Karnataka', districts: ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir'] },
  { name: 'Kerala', districts: ['Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'] },
  { name: 'Madhya Pradesh', districts: ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Narsinghpur', 'Neemuch', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'] },
  { name: 'Maharashtra', districts: ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'] },
  { name: 'Manipur', districts: ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'] },
  { name: 'Meghalaya', districts: ['East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills', 'North Garo Hills', 'Ri Bhoi', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills'] },
  { name: 'Mizoram', districts: ['Aizawl', 'Champhai', 'Hnahthial', 'Kolasib', 'Khawzawl', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'] },
  { name: 'Nagaland', districts: ['Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon', 'Peren', 'Phek', 'Tuensang', 'Wokha', 'Zunheboto'] },
  { name: 'Odisha', districts: ['Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack', 'Debagarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'] },
  { name: 'Punjab', districts: ['Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Mansa', 'Moga', 'Muktsar', 'Nawanshahr', 'Pathankot', 'Patiala', 'Rupnagar', 'Sahibzada Ajit Singh Nagar', 'Sangrur', 'Tarn Taran'] },
  { name: 'Rajasthan', districts: ['Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'] },
  { name: 'Sikkim', districts: ['East Sikkim', 'North Sikkim', 'South Sikkim', 'West Sikkim'] },
  { name: 'Tamil Nadu', districts: ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupattur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'] },
  { name: 'Telangana', districts: ['Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Komaram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ranga Reddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal Rural', 'Warangal Urban', 'Yadadri Bhuvanagiri'] },
  { name: 'Tripura', districts: ['Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura', 'Unakoti', 'West Tripura'] },
  { name: 'Uttar Pradesh', districts: ['Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Ayodhya', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kushinagar', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'] },
  { name: 'Uttarakhand', districts: ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'] },
  { name: 'West Bengal', districts: ['Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'] }
];

const COUNTRIES = [
  'India',
  'United States',
  'Canada', 
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Singapore',
  'United Arab Emirates',
  'Japan',
  'Other'
];

// Address Form Component - Outside Profile to prevent recreation and focus loss
const AddressForm = memo<{
  addressData: any
  editingSection: string | null
  sectionData: any
  setSectionData: (data: any) => void
}>(({ addressData, editingSection, sectionData, setSectionData }) => {
  const [sameAddress, setSameAddress] = useState(false)
  const [currentCountry, setCurrentCountry] = useState('India')
  const [permanentCountry, setPermanentCountry] = useState('India')
  
  const currentAddress = addressData?.find((addr: any) => addr.addressType === 'CURRENT') || {}
  const permanentAddress = addressData?.find((addr: any) => addr.addressType === 'PERMANENT') || {}

  // Auto-populate address from pincode
  const handlePincodeChange = useCallback(async (pincode: string, addressType: 'current' | 'permanent') => {
    if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
        const data = await response.json()
        
        if (data[0].Status === 'Success') {
          const postOffice = data[0].PostOffice[0]
          const updates = {
            [`${addressType}City`]: postOffice.Block, // Use Block for city as requested
            [`${addressType}District`]: postOffice.District,
            [`${addressType}State`]: postOffice.State,
          }
          
          setSectionData((prev: any) => ({ 
            ...prev, 
            ...updates,
            ...(sameAddress && addressType === 'current' ? {
              permanentCity: postOffice.Block, // Use Block for city as requested
              permanentDistrict: postOffice.District, 
              permanentState: postOffice.State,
            } : {})
          }))
        }
      } catch (error) {
        console.log('Could not fetch pincode data')
      }
    }
  }, [setSectionData, sameAddress])

  const isEditing = editingSection === 'address'

  // Get districts for selected state
  const getCurrentDistricts = () => {
    if (currentCountry === 'India') {
      const state = INDIAN_STATES.find(s => s.name === sectionData.currentState)
      return state ? state.districts : []
    }
    return []
  }

  const getPermanentDistricts = () => {
    if (permanentCountry === 'India') {
      const state = INDIAN_STATES.find(s => s.name === sectionData.permanentState)
      return state ? state.districts : []
    }
    return []
  }

  // Handle same address checkbox
  const handleSameAddressChange = useCallback((checked: boolean) => {
    setSameAddress(checked)
    if (checked && isEditing) {
      // Copy current address to permanent address in section data
      const currentData = {
        permanentAddressLine1: sectionData.currentAddressLine1 || '',
        permanentAddressLine2: sectionData.currentAddressLine2 || '',
        permanentCity: sectionData.currentCity || '',
        permanentDistrict: sectionData.currentDistrict || '',
        permanentState: sectionData.currentState || '',
        permanentPincode: sectionData.currentPincode || '',
        permanentCountry: currentCountry,
      }
      setSectionData((prev: any) => ({ ...prev, ...currentData }))
      setPermanentCountry(currentCountry)
    }
  }, [sectionData, isEditing, setSectionData, currentCountry])

  // Handle country change
  const handleCountryChange = useCallback((country: string, addressType: 'current' | 'permanent') => {
    if (addressType === 'current') {
      setCurrentCountry(country)
      setSectionData((prev: any) => ({ 
        ...prev, 
        currentCountry: country,
        ...(country !== 'India' ? { currentState: '', currentDistrict: '' } : {}),
        ...(sameAddress ? { 
          permanentCountry: country,
          ...(country !== 'India' ? { permanentState: '', permanentDistrict: '' } : {})
        } : {})
      }))
      if (sameAddress) setPermanentCountry(country)
    } else {
      setPermanentCountry(country)
      setSectionData((prev: any) => ({ 
        ...prev, 
        permanentCountry: country,
        ...(country !== 'India' ? { permanentState: '', permanentDistrict: '' } : {})
      }))
    }
  }, [setSectionData, sameAddress])

  const handleCurrentFieldChange = useCallback((field: string, value: string) => {
    setSectionData((prev: any) => ({ 
      ...prev, 
      [field]: value,
      ...(sameAddress ? { [field.replace('current', 'permanent')]: value } : {})
    }))
  }, [setSectionData, sameAddress])

  const handlePermanentFieldChange = useCallback((field: string, value: string) => {
    setSectionData((prev: any) => ({ ...prev, [field]: value }))
  }, [setSectionData])

  if (isEditing) {
    return (
      <div className="space-y-6">
        {/* Same Address Checkbox */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="sameAddress"
            checked={sameAddress}
            onChange={(e) => handleSameAddressChange(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="sameAddress" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Permanent address is same as current address
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Address */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Current Address</h4>
            
            <div className="space-y-4">
              {/* Country Selection - First */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Country *</label>
                <select
                  value={currentCountry}
                  onChange={(e) => {
                    setCurrentCountry(e.target.value)
                    setSectionData((prev) => ({ ...prev, currentCountry: e.target.value }))
                  }}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pincode - Second */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pincode *</label>
                <input
                  type="text"
                  value={sectionData.currentPincode || currentAddress.postalCode || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6) // Only digits, max 6
                    handleCurrentFieldChange('currentPincode', value)
                    if (currentCountry === 'India') {
                      handlePincodeChange(value, 'current')
                    }
                  }}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder={currentCountry === 'India' ? 'Enter 6-digit pincode' : 'Enter postal code'}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* State and District - Third row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">State *</label>
                  {currentCountry === 'India' ? (
                    <select
                      value={sectionData.currentState || currentAddress.state || ''}
                      onChange={(e) => {
                        handleCurrentFieldChange('currentState', e.target.value)
                        handleCurrentFieldChange('currentDistrict', '') // Reset district when state changes
                      }}
                      className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state.name} value={state.name}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={sectionData.currentState || currentAddress.state || ''}
                      onChange={(e) => handleCurrentFieldChange('currentState', e.target.value)}
                      placeholder="Enter state"
                      className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">District</label>
                  {currentCountry === 'India' ? (
                    <select
                      value={sectionData.currentDistrict || currentAddress.district || ''}
                      onChange={(e) => handleCurrentFieldChange('currentDistrict', e.target.value)}
                      className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select District</option>
                      {getCurrentDistricts().map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={sectionData.currentDistrict || currentAddress.district || ''}
                      onChange={(e) => handleCurrentFieldChange('currentDistrict', e.target.value)}
                      placeholder="Enter district"
                      className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  )}
                </div>
              </div>

              {/* City - Fourth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">City *</label>
                <input
                  type="text"
                  value={sectionData.currentCity || currentAddress.city || ''}
                  onChange={(e) => handleCurrentFieldChange('currentCity', e.target.value)}
                  placeholder="Enter city (auto-filled from pincode but can be changed)"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Address Lines - Last */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address Line 1 *</label>
                <input
                  type="text"
                  value={sectionData.currentAddressLine1 || currentAddress.addressLine1 || ''}
                  onChange={(e) => handleCurrentFieldChange('currentAddressLine1', e.target.value)}
                  placeholder="Enter address line 1"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address Line 2</label>
                <input
                  type="text"
                  value={sectionData.currentAddressLine2 || currentAddress.addressLine2 || ''}
                  onChange={(e) => handleCurrentFieldChange('currentAddressLine2', e.target.value)}
                  placeholder="Enter address line 2 (optional)"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Permanent Address */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Permanent Address</h4>
            
            <div className="space-y-4">
              {/* Country Selection - First */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Country *</label>
                <select
                  value={permanentCountry}
                  onChange={(e) => {
                    setPermanentCountry(e.target.value)
                    setSectionData((prev) => ({ ...prev, permanentCountry: e.target.value }))
                  }}
                  disabled={sameAddress}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pincode - Second */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pincode *</label>
                <input
                  type="text"
                  value={sectionData.permanentPincode || permanentAddress.postalCode || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6) // Only digits, max 6
                    handlePermanentFieldChange('permanentPincode', value)
                    if (permanentCountry === 'India' && !sameAddress) {
                      handlePincodeChange(value, 'permanent')
                    }
                  }}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder={permanentCountry === 'India' ? 'Enter 6-digit pincode' : 'Enter postal code'}
                  disabled={sameAddress}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* State and District - Third row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">State *</label>
                  {permanentCountry === 'India' ? (
                    <select
                      value={sectionData.permanentState || permanentAddress.state || ''}
                      onChange={(e) => {
                        handlePermanentFieldChange('permanentState', e.target.value)
                        handlePermanentFieldChange('permanentDistrict', '') // Reset district when state changes
                      }}
                      disabled={sameAddress}
                      className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state.name} value={state.name}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={sectionData.permanentState || permanentAddress.state || ''}
                      onChange={(e) => handlePermanentFieldChange('permanentState', e.target.value)}
                      placeholder="Enter state"
                      disabled={sameAddress}
                      className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">District</label>
                  {permanentCountry === 'India' ? (
                    <select
                      value={sectionData.permanentDistrict || permanentAddress.district || ''}
                      onChange={(e) => handlePermanentFieldChange('permanentDistrict', e.target.value)}
                      disabled={sameAddress}
                      className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">Select District</option>
                      {getPermanentDistricts().map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={sectionData.permanentDistrict || permanentAddress.district || ''}
                      onChange={(e) => handlePermanentFieldChange('permanentDistrict', e.target.value)}
                      placeholder="Enter district"
                      disabled={sameAddress}
                      className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  )}
                </div>
              </div>

              {/* City - Fourth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">City *</label>
                <input
                  type="text"
                  value={sectionData.permanentCity || permanentAddress.city || ''}
                  onChange={(e) => handlePermanentFieldChange('permanentCity', e.target.value)}
                  placeholder="Enter city (auto-filled from pincode but can be changed)"
                  disabled={sameAddress}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* Address Lines - Last */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address Line 1 *</label>
                <input
                  type="text"
                  value={sectionData.permanentAddressLine1 || permanentAddress.addressLine1 || ''}
                  onChange={(e) => handlePermanentFieldChange('permanentAddressLine1', e.target.value)}
                  placeholder="Enter address line 1"
                  disabled={sameAddress}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address Line 2</label>
                <input
                  type="text"
                  value={sectionData.permanentAddressLine2 || permanentAddress.addressLine2 || ''}
                  onChange={(e) => handlePermanentFieldChange('permanentAddressLine2', e.target.value)}
                  placeholder="Enter address line 2 (optional)"
                  disabled={sameAddress}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Display mode
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Current Address Display */}
      <div>
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Current Address
        </h4>
        <div className="text-sm text-gray-900 dark:text-white space-y-1">
          {currentAddress.addressLine1 ? (
            <>
              <div><span className="font-medium">Address:</span> {currentAddress.addressLine1}</div>
              {currentAddress.addressLine2 && <div><span className="font-medium">Address 2:</span> {currentAddress.addressLine2}</div>}
              <div><span className="font-medium">City:</span> {currentAddress.city}</div>
              {currentAddress.district && <div><span className="font-medium">District:</span> {currentAddress.district}</div>}
              <div><span className="font-medium">State:</span> {currentAddress.state} - <span className="font-medium">Pincode:</span> {currentAddress.postalCode}</div>
              <div><span className="font-medium">Country:</span> {currentAddress.country}</div>
            </>
          ) : (
            <span className="text-gray-500">Not provided</span>
          )}
        </div>
      </div>

      {/* Permanent Address Display */}
      <div>
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Permanent Address
        </h4>
        <div className="text-sm text-gray-900 dark:text-white space-y-1">
          {permanentAddress.addressLine1 ? (
            <>
              <div><span className="font-medium">Address:</span> {permanentAddress.addressLine1}</div>
              {permanentAddress.addressLine2 && <div><span className="font-medium">Address 2:</span> {permanentAddress.addressLine2}</div>}
              <div><span className="font-medium">City:</span> {permanentAddress.city}</div>
              {permanentAddress.district && <div><span className="font-medium">District:</span> {permanentAddress.district}</div>}
              <div><span className="font-medium">State:</span> {permanentAddress.state} - <span className="font-medium">Pincode:</span> {permanentAddress.postalCode}</div>
              <div><span className="font-medium">Country:</span> {permanentAddress.country}</div>
            </>
          ) : (
            <span className="text-gray-500">Not provided</span>
          )}
        </div>
      </div>
    </div>
  )
})

// Education Section Component - LinkedIn Style
const EducationSection = memo<{
  educationData: any
}>(({ educationData }) => {
  const [addEducation] = useAddEducationMutation()
  const [updateEducation] = useUpdateEducationMutation()
  const [deleteEducation] = useDeleteEducationMutation()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    course: '',
    stream: '',
    institution: '',
    fromYear: '',
    toYear: '',
    isOngoing: false,
    description: ''
  })

  const resetForm = () => {
    setFormData({
      course: '',
      stream: '',
      institution: '',
      fromYear: '',
      toYear: '',
      isOngoing: false,
      description: ''
    })
    setShowAddForm(false)
    setEditingId(null)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.course || !formData.institution || !formData.fromYear) return

    try {
      await addEducation({
        course: formData.course,
        stream: formData.stream || '',
        institution: formData.institution,
        fromYear: parseInt(formData.fromYear),
        toYear: formData.isOngoing ? undefined : parseInt(formData.toYear),
        isOngoing: formData.isOngoing,
        description: formData.description || ''
      }).unwrap()
      resetForm()
    } catch (error) {
      console.error('Failed to add education:', error)
    }
  }

  const handleEdit = (edu: any) => {
    setFormData({
      course: edu.course,
      stream: edu.stream || '',
      institution: edu.institution,
      fromYear: edu.fromYear.toString(),
      toYear: edu.toYear ? edu.toYear.toString() : '',
      isOngoing: edu.isOngoing,
      description: edu.description || ''
    })
    setEditingId(edu.id)
    setShowAddForm(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !formData.course || !formData.institution || !formData.fromYear) return

    try {
      await updateEducation({
        educationId: editingId,
        data: {
          course: formData.course,
          stream: formData.stream,
          institution: formData.institution,
          fromYear: parseInt(formData.fromYear),
          toYear: formData.isOngoing ? undefined : parseInt(formData.toYear),
          isOngoing: formData.isOngoing,
          description: formData.description
        }
      }).unwrap()
      resetForm()
    } catch (error) {
      console.error('Failed to update education:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this education record?')) {
      try {
        await deleteEducation(id).unwrap()
      } catch (error) {
        console.error('Failed to delete education:', error)
      }
    }
  }

  // Sort education by fromYear descending (most recent first)
  const sortedEducation = [...(educationData || [])].sort((a, b) => b.fromYear - a.fromYear)
  const hasMaxEducation = sortedEducation.length >= 3

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <AcademicCapIcon className="h-5 w-5 mr-2" />
          Education
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={hasMaxEducation && !editingId}
          className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
            hasMaxEducation && !editingId 
              ? 'text-gray-400 cursor-not-allowed' 
              : 'text-blue-600 hover:text-blue-700 dark:text-blue-400'
          }`}
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          {hasMaxEducation && !editingId ? 'Maximum 3 Education Entries' : 'Add Education'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form onSubmit={editingId ? handleUpdate : handleAdd} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
            {editingId ? 'Edit Education' : 'Add Education'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Course/Degree *
              </label>
              <input
                type="text"
                required
                value={formData.course}
                onChange={(e) => setFormData(prev => ({ ...prev, course: e.target.value }))}
                placeholder="e.g., Bachelor of Technology, MBA, XII"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Field of Study
              </label>
              <input
                type="text"
                value={formData.stream}
                onChange={(e) => setFormData(prev => ({ ...prev, stream: e.target.value }))}
                placeholder="e.g., Computer Science, Finance"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Institution *
              </label>
              <input
                type="text"
                required
                value={formData.institution}
                onChange={(e) => setFormData(prev => ({ ...prev, institution: e.target.value }))}
                placeholder="School/College/University name"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Year *
              </label>
              <input
                type="number"
                required
                min="1950"
                max={new Date().getFullYear() + 10}
                value={formData.fromYear}
                onChange={(e) => setFormData(prev => ({ ...prev, fromYear: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Year
              </label>
              <input
                type="number"
                min="1950"
                max={new Date().getFullYear() + 10}
                value={formData.toYear}
                onChange={(e) => setFormData(prev => ({ ...prev, toYear: e.target.value }))}
                disabled={formData.isOngoing}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
              />
            </div>
            <div className="md:col-span-2 flex items-center">
              <input
                type="checkbox"
                id="education-ongoing"
                checked={formData.isOngoing}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  isOngoing: e.target.checked, 
                  toYear: e.target.checked ? '' : prev.toYear 
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="education-ongoing" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                I am currently studying here
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your studies, achievements, activities..."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {editingId ? 'Update' : 'Add'} Education
            </button>
          </div>
        </form>
      )}

      {/* Education List */}
      <div className="space-y-4">
        {sortedEducation.length > 0 ? (
          sortedEducation.map((edu: any) => (
            <div key={edu.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {edu.course}
                    {edu.stream && <span className="text-gray-600 dark:text-gray-400"> • {edu.stream}</span>}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{edu.institution}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {edu.fromYear} - {edu.isOngoing ? 'Present' : edu.toYear}
                  </p>
                  {edu.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{edu.description}</p>
                  )}
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(edu)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(edu.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <AcademicCapIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No education history added yet</p>
            <p className="text-sm">Add your educational background to showcase your qualifications</p>
          </div>
        )}
      </div>
    </div>
  )
})

// Work Experience Section Component - LinkedIn Style  
const WorkExperienceSection = memo<{
  workData: any
}>(({ workData }) => {
  const [addWorkExperience] = useAddWorkExperienceMutation()
  const [updateWorkExperience] = useUpdateWorkExperienceMutation()
  const [deleteWorkExperience] = useDeleteWorkExperienceMutation()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    jobRole: '',
    companyName: '',
    companyType: '',
    workAddress: '',
    fromYear: '',
    toYear: '',
    isCurrentJob: false,
    description: ''
  })

  const companyTypes = [
    'GOVERNMENT',
    'PRIVATE', 
    'STARTUP',
    'NGO',
    'FREELANCE',
    'SELF_EMPLOYED'
  ]

  const resetForm = () => {
    setFormData({
      jobRole: '',
      companyName: '',
      companyType: '',
      workAddress: '',
      fromYear: '',
      toYear: '',
      isCurrentJob: false,
      description: ''
    })
    setShowAddForm(false)
    setEditingId(null)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.jobRole || !formData.companyName || !formData.fromYear) return

    try {
      await addWorkExperience({
        jobRole: formData.jobRole,
        companyName: formData.companyName,
        companyType: formData.companyType as any || undefined,
        workAddress: formData.workAddress || undefined,
        fromYear: parseInt(formData.fromYear),
        toYear: formData.isCurrentJob ? undefined : parseInt(formData.toYear),
        isCurrentJob: formData.isCurrentJob,
        description: formData.description || undefined
      }).unwrap()
      resetForm()
    } catch (error) {
      console.error('Failed to add work experience:', error)
    }
  }

  const handleEdit = (work: any) => {
    setFormData({
      jobRole: work.jobRole,
      companyName: work.companyName,
      companyType: work.companyType || '',
      workAddress: work.workAddress || '',
      fromYear: work.fromYear.toString(),
      toYear: work.toYear ? work.toYear.toString() : '',
      isCurrentJob: work.isCurrentJob,
      description: work.description || ''
    })
    setEditingId(work.id)
    setShowAddForm(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !formData.jobRole || !formData.companyName || !formData.fromYear) return

    try {
      await updateWorkExperience({
        workId: editingId,
        data: {
          jobRole: formData.jobRole,
          companyName: formData.companyName,
          companyType: formData.companyType as any || undefined,
          workAddress: formData.workAddress || undefined,
          fromYear: parseInt(formData.fromYear),
          toYear: formData.isCurrentJob ? undefined : parseInt(formData.toYear),
          isCurrentJob: formData.isCurrentJob,
          description: formData.description || undefined
        }
      }).unwrap()
      resetForm()
    } catch (error) {
      console.error('Failed to update work experience:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this work experience?')) {
      try {
        await deleteWorkExperience(id).unwrap()
      } catch (error) {
        console.error('Failed to delete work experience:', error)
      }
    }
  }

  // Sort work experience by fromYear descending (most recent first)
  const sortedWork = [...(workData || [])].sort((a, b) => b.fromYear - a.fromYear)
  const hasMaxWork = sortedWork.length >= 3

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <BriefcaseIcon className="h-5 w-5 mr-2" />
          Work Experience
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={hasMaxWork && !editingId}
          className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
            hasMaxWork && !editingId 
              ? 'text-gray-400 cursor-not-allowed' 
              : 'text-blue-600 hover:text-blue-700 dark:text-blue-400'
          }`}
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          {hasMaxWork && !editingId ? 'Maximum 3 Work Experiences' : 'Add Experience'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form onSubmit={editingId ? handleUpdate : handleAdd} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
            {editingId ? 'Edit Experience' : 'Add Experience'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={formData.jobRole}
                onChange={(e) => setFormData(prev => ({ ...prev, jobRole: e.target.value }))}
                placeholder="e.g., Software Developer, Marketing Manager"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company *
              </label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Company name"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Type
              </label>
              <select
                value={formData.companyType}
                onChange={(e) => setFormData(prev => ({ ...prev, companyType: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              >
                <option value="">Select type</option>
                {companyTypes.map(type => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.workAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, workAddress: e.target.value }))}
                placeholder="City, State, Country"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Year *
              </label>
              <input
                type="number"
                required
                min="1950"
                max={new Date().getFullYear()}
                value={formData.fromYear}
                onChange={(e) => setFormData(prev => ({ ...prev, fromYear: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Year
              </label>
              <input
                type="number"
                min="1950"
                max={new Date().getFullYear()}
                value={formData.toYear}
                onChange={(e) => setFormData(prev => ({ ...prev, toYear: e.target.value }))}
                disabled={formData.isCurrentJob}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
              />
            </div>
            <div className="md:col-span-2 flex items-center">
              <input
                type="checkbox"
                id="work-current"
                checked={formData.isCurrentJob}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  isCurrentJob: e.target.checked, 
                  toYear: e.target.checked ? '' : prev.toYear 
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="work-current" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                I currently work here
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your role, responsibilities, achievements..."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {editingId ? 'Update' : 'Add'} Experience
            </button>
          </div>
        </form>
      )}

      {/* Work Experience List */}
      <div className="space-y-4">
        {sortedWork.length > 0 ? (
          sortedWork.map((work: any) => (
            <div key={work.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {work.jobRole}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{work.companyName}</p>
                  <div className="flex items-center text-sm text-gray-500 mt-1 space-x-2">
                    <span>{work.fromYear} - {work.isCurrentJob ? 'Present' : work.toYear}</span>
                    {work.workAddress && (
                      <>
                        <span>•</span>
                        <span>{work.workAddress}</span>
                      </>
                    )}
                    {work.companyType && (
                      <>
                        <span>•</span>
                        <span>{work.companyType.replace('_', ' ')}</span>
                      </>
                    )}
                  </div>
                  {work.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{work.description}</p>
                  )}
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(work)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(work.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <BriefcaseIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No work experience added yet</p>
            <p className="text-sm">Add your professional experience to showcase your career journey</p>
          </div>
        )}
      </div>
    </div>
  )
})

const Profile: React.FC = () => {
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useGetProfileQuery(undefined, {
    // Disable automatic refetching that might cause re-renders
    refetchOnFocus: false,
    refetchOnReconnect: false,
    refetchOnMountOrArgChange: false,
  })
  const { auth } = useAuth()

  const [updateProfile] = useUpdateProfileMutation()
  const [deleteProfilePicture] = useDeleteProfilePictureMutation()
  const { data: addressData, error: addressError, isLoading: addressLoading, refetch: refetchAddresses } = useGetAddressesQuery()
  const [updateAddress] = useUpdateAddressMutation()
  const { data: educationData } = useGetEducationHistoryQuery()
  const { data: workData } = useGetWorkHistoryQuery()
  const [activeTab, setActiveTab] = useState<
    'about' | 'address' | 'career' | 'documents' | 'assets' | 'social'
  >('about')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [sectionData, setSectionData] = useState<Record<string, any>>({})
  const [showProfilePictureMenu, setShowProfilePictureMenu] = useState(false)
  const [imageTimestamp, setImageTimestamp] = useState(Date.now())
  const [showIdentityCard, setShowIdentityCard] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // CRITICAL: All hooks must be called before early returns to avoid hooks violation
  const handleSectionFieldChange = useCallback((field: string, value: any) => {
    setSectionData((prev) => ({ ...prev, [field]: value }))
  }, [])


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfilePictureMenu(false)
      }
    }

    if (showProfilePictureMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfilePictureMenu])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">
            Failed to load profile
          </p>
        </div>
      </div>
    )
  }

  // Removed mock data - using real API data from hooks above


  // Section editing functions
  const handleEditSection = (section: string) => {
    setEditingSection(section)

    // Initialize section data based on section type
    switch (section) {
      case 'personal':
        setSectionData({
          bio: profile.bio || '',
          dateOfBirth: profile.dateOfBirth
            ? profile.dateOfBirth.split('T')[0]
            : '',
          employmentStatus: profile.employmentStatus || 'OPEN_TO_WORK',
          bloodGroup: profile.bloodGroup || '',
        })
        break
      case 'contact':
        setSectionData({
          whatsappNumber: profile.whatsappNumber || '',
          alternateNumber: profile.alternateNumber || '',
          showEmail: profile.showEmail ?? true,
          showPhone: profile.showPhone ?? false,
        })
        break
      case 'social':
        setSectionData({
          linkedinUrl: profile.linkedinUrl || '',
          instagramUrl: profile.instagramUrl || '',
          facebookUrl: profile.facebookUrl || '',
          twitterUrl: profile.twitterUrl || '',
          portfolioUrl: profile.portfolioUrl || '',
        })
        break
      case 'privacy':
        setSectionData({
          isProfilePublic: profile.isProfilePublic ?? true,
          showEmail: profile.showEmail ?? true,
          showPhone: profile.showPhone ?? false,
        })
        break
      case 'address':
        const currentAddr = addressData?.find((addr: any) => addr.addressType === 'CURRENT') || {
          addressLine1: '',
          addressLine2: '',
          city: '',
          district: '',
          state: '',
          postalCode: '',
          country: 'India'
        }
        const permanentAddr = addressData?.find((addr: any) => addr.addressType === 'PERMANENT') || {
          addressLine1: '',
          addressLine2: '',
          city: '',
          district: '',
          state: '',
          postalCode: '',
          country: 'India'
        }
        setSectionData({
          currentAddressLine1: currentAddr.addressLine1 || '',
          currentAddressLine2: currentAddr.addressLine2 || '',
          currentCity: currentAddr.city || '',
          currentDistrict: currentAddr.district || '',
          currentState: currentAddr.state || '',
          currentPincode: currentAddr.postalCode || '',
          currentCountry: currentAddr.country || 'India',
          permanentAddressLine1: permanentAddr.addressLine1 || '',
          permanentAddressLine2: permanentAddr.addressLine2 || '',
          permanentCity: permanentAddr.city || '',
          permanentDistrict: permanentAddr.district || '',
          permanentState: permanentAddr.state || '',
          permanentPincode: permanentAddr.postalCode || '',
          permanentCountry: permanentAddr.country || 'India',
        })
        break
      default:
        setSectionData({})
    }
  }

  const handleSaveSection = async (section: string) => {
    try {
      if (section === 'address') {
        // Handle address data separately using the updateAddress API
        // Only send fields that exist in the UpdateAddressRequest interface
        const currentAddressData = {
          addressLine1: sectionData.currentAddressLine1 || '',
          addressLine2: sectionData.currentAddressLine2 || '',
          city: sectionData.currentCity || '',
          district: sectionData.currentDistrict || '',
          state: sectionData.currentState || '',
          postalCode: sectionData.currentPincode || '',
          country: sectionData.currentCountry || 'India',
        }

        const permanentAddressData = {
          addressLine1: sectionData.permanentAddressLine1 || '',
          addressLine2: sectionData.permanentAddressLine2 || '',
          city: sectionData.permanentCity || '',
          district: sectionData.permanentDistrict || '',
          state: sectionData.permanentState || '',
          postalCode: sectionData.permanentPincode || '',
          country: sectionData.permanentCountry || 'India',
        }

        // Update both addresses
        await Promise.all([
          updateAddress({ addressType: 'CURRENT', data: currentAddressData }).unwrap(),
          updateAddress({ addressType: 'PERMANENT', data: permanentAddressData }).unwrap()
        ])
        
        // Explicitly refetch address data to ensure UI updates
        await refetchAddresses()
      } else if (section === 'career') {
        // Career section handles its own saving through CareerForm component
        // Just exit editing mode
      } else {
        // Handle other profile sections normally
        await updateProfile(sectionData).unwrap()
      }

      setEditingSection(null)
      setSectionData({})
      alert('Section updated successfully!')

      // Refresh profile data
      await refetch()
    } catch (error) {
      console.error('Failed to update section:', error)
      alert('Failed to update section. Please try again.')
    }
  }

  const handleCancelEdit = () => {
    setEditingSection(null)
    setSectionData({})
  }

  // Profile picture upload functions
  const handleProfilePictureClick = () => {
    setShowProfilePictureMenu(!showProfilePictureMenu)
  }

  const handleUploadClick = () => {
    // Reset file input to ensure onChange fires even for same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    fileInputRef.current?.click()
    setShowProfilePictureMenu(false)
  }

  const handleDeleteClick = async () => {
    if (!profile.profileImage) return

    try {
      if (confirm('Are you sure you want to delete your profile picture?')) {
        await deleteProfilePicture().unwrap()
        alert('Profile picture deleted successfully!')

        // Update timestamp for cache-busting
        setImageTimestamp(Date.now())

        await refetch()
      }
    } catch (error: any) {
      console.error('❌ Failed to delete profile picture:', error)
      alert(
        error.message || 'Failed to delete profile picture. Please try again.'
      )
    } finally {
      setShowProfilePictureMenu(false)
    }
  }

  const handleProfilePictureChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    try {
      const formData = new FormData()
      formData.append('profileImage', file)

      console.log('🔍 Uploading file:', file.name, file.type, file.size)
      console.log('🔍 Using plain fetch (like organization logo upload)')

      // Use plain fetch instead of RTK Query (like organization logo upload)
      console.log('🔍 Making fetch request with FormData')
      console.log('🔍 Auth token exists:', !!auth?.token)

      const response = await fetch(
        'http://localhost:3000/api/users/profile-picture',
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${auth?.token}`,
          },
          body: formData,
        }
      )

      console.log('🔍 Response status:', response.status)
      console.log('🔍 Response headers:', [...response.headers.entries()])

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed')
      }

      console.log('✅ Profile picture uploaded successfully:', result)
      alert(
        profile.profileImage
          ? 'Profile picture replaced successfully!'
          : 'Profile picture uploaded successfully!'
      )

      // Update timestamp for cache-busting
      setImageTimestamp(Date.now())

      // Refresh profile data to show new image
      await refetch()

      // Reset file input to allow re-uploading the same file if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      console.error('❌ Failed to upload profile picture:', error)
      alert(
        error.message || 'Failed to upload profile picture. Please try again.'
      )
    }
  }

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    const fields = [
      { value: profile.fullName, weight: 10 },
      { value: profile.email, weight: 10 },
      { value: profile.batch, weight: 10 },
      { value: profile.bio, weight: 10 },
      { value: profile.dateOfBirth, weight: 5 },
      { value: profile.employmentStatus, weight: 10 },
      { value: profile.bloodGroup, weight: 5 },
      { value: profile.whatsappNumber, weight: 10 },
      { value: profile.profileImage, weight: 10 },
      { value: profile.admissionYear, weight: 5 },
      { value: profile.passoutYear, weight: 5 },
      { value: profile.linkedinUrl || profile.facebookUrl || profile.instagramUrl || profile.twitterUrl || profile.portfolioUrl, weight: 5 },
    ]
    
    const totalWeight = fields.reduce((sum, field) => sum + field.weight, 0)
    const completedWeight = fields.reduce((sum, field) => {
      return sum + (field.value ? field.weight : 0)
    }, 0)
    
    return Math.round((completedWeight / totalWeight) * 100)
  }

  const profileCompletionPercentage = calculateProfileCompletion()

  // Status Badge Component
  const StatusBadge = () => {
    if (profile.verificationContext?.isBlacklisted) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          Blacklisted
        </span>
      )
    }
    if (profile.isRejected) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          Rejected
        </span>
      )
    }
    if (profile.pendingVerification) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
          Pending
        </span>
      )
    }
    if (profile.isAlumniVerified) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 mx-auto sm:mx-0">
          <CheckBadgeIconSolid className="h-3 w-3 mr-1" />
          Verified Alumni
        </span>
      )
    }
    return null
  }

  // Membership Status Badge Component
  const MembershipStatusBadge = () => {
    const { data: membershipData } = useGetMembershipStatusQuery()
    const status = membershipData?.status || profile.membershipStatus

    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'ACTIVE':
          return {
            color:
              'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
            label: 'Active Member',
            icon: CheckBadgeIconSolid,
          }
        case 'EXPIRED':
          return {
            color:
              'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
            label: 'Expired',
            icon: ClockIcon,
          }
        case 'PENDING':
          return {
            color:
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
            label: 'Pending',
            icon: ClockIcon,
          }
        case 'SUSPENDED':
          return {
            color:
              'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
            label: 'Suspended',
            icon: XCircleIcon,
          }
        default:
          return {
            color:
              'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
            label: 'Inactive',
            icon: XCircleIcon,
          }
      }
    }

    const config = getStatusConfig(status)
    const Icon = config.icon

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      >
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </span>
    )
  }

  // Privacy Toggle Component
  // Privacy Toggles Component - Interactive toggles for privacy settings
  const PrivacyToggles = () => {
    const [privacySettings, setPrivacySettings] = useState({
      isProfilePublic: profile.isProfilePublic,
      showEmail: profile.showEmail,
      showPhone: profile.showPhone,
    })
    const [isSaving, setIsSaving] = useState(false)

    const handleToggle = async (field: string, value: boolean) => {
      const newSettings = { ...privacySettings, [field]: value }
      setPrivacySettings(newSettings)
      
      // Auto-save privacy settings
      try {
        setIsSaving(true)
        await updateProfile({ [field]: value }).unwrap()
        await refetch()
      } catch (error) {
        console.error('Failed to update privacy setting:', error)
        // Revert on error
        setPrivacySettings(privacySettings)
      } finally {
        setIsSaving(false)
      }
    }

    return (
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6">
        {/* Profile Visibility Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggle('isProfilePublic', !privacySettings.isProfilePublic)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              privacySettings.isProfilePublic ? 'bg-green-500' : 'bg-gray-400'
            } ${isSaving ? 'opacity-50' : ''}`}
            disabled={isSaving}
          >
            <span className="sr-only">Toggle public profile</span>
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                privacySettings.isProfilePublic ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <GlobeAltIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
            <span className="text-xs sm:text-sm text-gray-300 whitespace-nowrap">Public Profile</span>
          </div>
        </div>

        {/* Show Email Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggle('showEmail', !privacySettings.showEmail)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              privacySettings.showEmail ? 'bg-green-500' : 'bg-gray-400'
            } ${isSaving ? 'opacity-50' : ''}`}
            disabled={isSaving}
          >
            <span className="sr-only">Toggle show email</span>
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                privacySettings.showEmail ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <EnvelopeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
            <span className="text-xs sm:text-sm text-gray-300 whitespace-nowrap">Show Email</span>
          </div>
        </div>

        {/* Show Phone Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggle('showPhone', !privacySettings.showPhone)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              privacySettings.showPhone ? 'bg-green-500' : 'bg-gray-400'
            } ${isSaving ? 'opacity-50' : ''}`}
            disabled={isSaving}
          >
            <span className="sr-only">Toggle show phone</span>
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                privacySettings.showPhone ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <PhoneIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
            <span className="text-xs sm:text-sm text-gray-300 whitespace-nowrap">Show Phone</span>
          </div>
        </div>
      </div>
    )
  }

  // Social Media Icons Component
  const SocialMediaIcons = () => {
    const socialLinks = [
      { url: profile.linkedinUrl, icon: 'linkedin', name: 'LinkedIn' },
      { url: profile.facebookUrl, icon: 'facebook', name: 'Facebook' },
      { url: profile.instagramUrl, icon: 'instagram', name: 'Instagram' },
      { url: profile.twitterUrl, icon: 'twitter', name: 'Twitter' },
      { url: profile.portfolioUrl, icon: 'portfolio', name: 'Portfolio' },
    ].filter((link) => link.url)

    if (socialLinks.length === 0) return null

    const getSocialIcon = (icon: string) => {
      switch (icon) {
        case 'linkedin':
          return (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          )
        case 'facebook':
          return (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )
        case 'instagram':
          return (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.618 5.367 11.986 11.988 11.986 6.618 0 11.986-5.368 11.986-11.986C24.003 5.367 18.635.001 12.017.001zM8.449 2.678c3.549 0 6.42 2.87 6.42 6.42 0 3.548-2.871 6.419-6.42 6.419-3.548 0-6.419-2.871-6.419-6.419 0-3.55 2.871-6.42 6.419-6.42zm7.064 16.646h-1.905v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H7.715V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286z" />
            </svg>
          )
        case 'twitter':
          return (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
            </svg>
          )
        case 'portfolio':
          return <GlobeAltIcon className="h-5 w-5" />
        default:
          return <LinkIcon className="h-5 w-5" />
      }
    }

    return (
      <div className="flex items-center justify-center sm:justify-start space-x-3">
        {socialLinks.map((link, index) => (
          <a
            key={index}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/70 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
            title={link.name}
          >
            {getSocialIcon(link.icon)}
          </a>
        ))}
      </div>
    )
  }

  // Section Display Component
  // Move SectionCard outside component to prevent recreation and focus loss



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Section - Similar to Keka Design */}
      <div className="relative">
        {/* Background Banner */}
        <div className="min-h-[400px] sm:min-h-0 sm:h-56 md:h-64 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 relative flex items-end justify-center sm:justify-start">
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>

          {/* Profile Info Overlay */}
          <div className="relative w-full pb-6 px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center sm:items-end space-y-4 sm:space-y-0 sm:space-x-6 md:space-x-8 z-10">
            {/* Profile Picture with Upload/Delete Menu */}
            <div className="relative flex-shrink-0 self-center sm:self-auto">
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden bg-white shadow-xl border-4 border-white">
                {profile.profileImage ? (
                  <img
                    src={`http://localhost:3000/api/users/profile-picture/${profile.id}?t=${imageTimestamp}`}
                    alt={profile.fullName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.setAttribute(
                        'style',
                        'display: flex'
                      )
                    }}
                  />
                ) : null}
                <div
                  className={`w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 ${profile.profileImage ? 'hidden' : ''}`}
                >
                  <UserIcon className="h-20 w-20 text-gray-400" />
                </div>
              </div>

              {/* Profile Picture Menu Button */}
              <button
                onClick={handleProfilePictureClick}
                className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 border-2 border-white dark:border-gray-800"
                title="Photo options"
              >
                <EllipsisVerticalIcon className="h-4 w-4 text-white" />
              </button>

              {/* Profile Picture Menu Dropdown */}
              {showProfilePictureMenu && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 py-1 z-50 animate-in slide-in-from-top-2 duration-200"
                >
                  <button
                    onClick={handleUploadClick}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-150 first:rounded-t-lg"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">
                      {profile.profileImage ? 'Replace Photo' : 'Upload Photo'}
                    </span>
                  </button>
                  {profile.profileImage && (
                    <>
                      <div className="border-t border-gray-100 dark:border-gray-600 my-1"></div>
                      <button
                        onClick={handleDeleteClick}
                        className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3 transition-colors duration-150 last:rounded-b-lg"
                      >
                        <TrashIcon className="h-4 w-4 text-red-500" />
                        <span className="font-medium">Delete Photo</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                className="hidden"
              />
            </div>

            {/* Profile Details */}
            <div className="text-white pb-2 flex-1 min-w-0 text-center sm:text-left w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start space-y-2 sm:space-y-0 sm:space-x-4 mb-3">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{profile.fullName}</h1>
                <StatusBadge />
              </div>
              
              {/* Serial ID Display */}
              {profile.serialId && (
                <div className="flex items-center justify-center sm:justify-start space-x-2 mb-2">
                  <IdentificationIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/80 flex-shrink-0" />
                  <span className="text-sm sm:text-base md:text-lg font-medium text-white/90">
                    Serial ID: <span className="font-bold">{profile.serialId}</span>
                  </span>
                </div>
              )}

              {/* Role and Membership Status */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 md:gap-4 mb-3">
                <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
                  <UserIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                    {profile.role.replace('_', ' ')}
                  </span>
                </div>
                <MembershipStatusBadge />
              </div>

              {/* Contact Info Row - Always visible to profile owner with privacy indicators */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2 sm:gap-4 md:gap-6 text-xs sm:text-sm text-white/90 mb-3">
                {/* Profile Privacy Indicator */}
                <div className="flex items-center justify-center sm:justify-start space-x-1 flex-shrink-0">
                  {profile.isProfilePublic ? (
                    <LockOpenIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400" title="Profile is public" />
                  ) : (
                    <LockClosedIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400" title="Profile is private" />
                  )}
                  <span className="text-xs whitespace-nowrap">Profile</span>
                </div>

                {/* Email with privacy indicator */}
                <div className="flex items-center justify-center sm:justify-start space-x-2 min-w-0">
                  <EnvelopeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{profile.email}</span>
                  {!profile.showEmail ? (
                    <LockClosedIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400 flex-shrink-0" title="Email hidden from others" />
                  ) : (
                    <LockOpenIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400 flex-shrink-0" title="Email visible to others" />
                  )}
                </div>

                {/* Phone numbers with privacy indicator - includes both WhatsApp and Alternate */}
                {(profile.whatsappNumber || profile.alternateNumber) && (
                  <div className="flex items-center justify-center sm:justify-start space-x-2 min-w-0">
                    <PhoneIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    <div className="flex items-center space-x-2 min-w-0">
                      {profile.whatsappNumber && (
                        <span title="WhatsApp" className="whitespace-nowrap">{profile.whatsappNumber}</span>
                      )}
                      {profile.whatsappNumber && profile.alternateNumber && (
                        <span className="text-white/50">|</span>
                      )}
                      {profile.alternateNumber && (
                        <span title="Alternate" className="whitespace-nowrap">{profile.alternateNumber}</span>
                      )}
                    </div>
                    {!profile.showPhone ? (
                      <LockClosedIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400 flex-shrink-0" title="Phone numbers hidden from others" />
                    ) : (
                      <LockOpenIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400 flex-shrink-0" title="Phone numbers visible to others" />
                    )}
                  </div>
                )}
              </div>

              {/* Social Media Icons */}
              <SocialMediaIcons />
            </div>
          </div>
        </div>

        {/* Alumni Info Bar with Privacy Toggles */}
        <div className="bg-gray-800 text-white px-4 sm:px-6 md:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">
                  Batch
                </div>
                <div className="text-sm font-medium">{profile.batch}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">
                  Admission Year
                </div>
                <div className="text-sm font-medium">
                  {profile.admissionYear || 'Not Set'}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-xs text-gray-400 uppercase tracking-wide">
                  Passout Year
                </div>
                <div className="text-sm font-medium">
                  {profile.passoutYear || 'Not Set'}
                </div>
              </div>
            </div>

            {/* Actions and Privacy Toggles on the right side */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                onClick={() => setShowIdentityCard(true)}
                className="inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
              >
                <IdentificationIcon className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">ID Card</span>
                <span className="sm:hidden">ID</span>
              </button>
              <PrivacyToggles />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Completion - Hidden when 100% complete */}
      {profileCompletionPercentage < 100 && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 md:px-8 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Profile Completion</span>
              <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">{profileCompletionPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  profileCompletionPercentage >= 80 ? 'bg-green-500' :
                  profileCompletionPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${profileCompletionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="px-4 sm:px-6 md:px-8">
          <nav className="flex space-x-4 sm:space-x-6 md:space-x-8 min-w-max sm:min-w-0">
            {[
              { key: 'about', label: 'ABOUT' },
              { key: 'address', label: 'ADDRESS' },
              { key: 'career', label: 'CAREER' },
              { key: 'social', label: 'SOCIAL SERVICE' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'about' | 'address' | 'career' | 'social')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6 md:space-y-8">
              {/* Personal Information Section - Clean Rewrite */}
              <SectionCard 
                title="Personal Information" 
                sectionKey="personal"
                editingSection={editingSection}
                onEditSection={handleEditSection}
                onSaveSection={handleSaveSection}
                onCancelEdit={handleCancelEdit}
              >
                <div className="space-y-4">
                  {/* About Me Field - Simple Approach */}
                  {editingSection === 'personal' ? (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        About Me
                      </label>
                      <textarea
                        defaultValue={profile.bio || ''}
                        onChange={(e) => {
                          // Simple: just update sectionData, no complex state management
                          setSectionData((prev) => ({
                            ...prev,
                            bio: e.target.value,
                          }))
                        }}
                        placeholder="Tell us about yourself."
                        rows={4}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                  ) : (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        About Me
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                        {profile.bio || 'Not Set'}
                      </dd>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {/* Admission Year */}
                    {editingSection === 'personal' ? (
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Admission Year
                        </label>
                        <input
                          type="number"
                          min="1950"
                          max={new Date().getFullYear()}
                          value={
                            sectionData.admissionYear ||
                            profile.admissionYear ||
                            ''
                          }
                          onChange={(e) => {
                            setSectionData((prev) => ({
                              ...prev,
                              admissionYear: parseInt(e.target.value) || null,
                            }))
                          }}
                          placeholder="e.g., 2010"
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Admission Year
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                          {profile.admissionYear || 'Not Set'}
                        </dd>
                      </div>
                    )}
                    {/* Passout Year */}
                    {editingSection === 'personal' ? (
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Passout Year
                        </label>
                        <input
                          type="number"
                          min="1950"
                          max={new Date().getFullYear() + 10}
                          value={
                            sectionData.passoutYear ||
                            profile.passoutYear ||
                            ''
                          }
                          onChange={(e) => {
                            setSectionData((prev) => ({
                              ...prev,
                              passoutYear: parseInt(e.target.value) || null,
                            }))
                          }}
                          placeholder="e.g., 2016"
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Passout Year
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                          {profile.passoutYear || 'Not Set'}
                        </dd>
                      </div>
                    )}
                    {/* Date of Birth */}
                    {editingSection === 'personal' ? (
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={
                            sectionData.dateOfBirth ||
                            profile.dateOfBirth?.split('T')[0] ||
                            ''
                          }
                          onChange={(e) => {
                            setSectionData((prev) => ({
                              ...prev,
                              dateOfBirth: e.target.value,
                            }))
                          }}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Date of Birth
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                          {profile.dateOfBirth?.split('T')[0] || 'Not Set'}
                        </dd>
                      </div>
                    )}

                    {/* Employment Status */}
                    {editingSection === 'personal' ? (
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Employment Status
                        </label>
                        <select
                          value={
                            sectionData.employmentStatus ||
                            profile.employmentStatus ||
                            ''
                          }
                          onChange={(e) => {
                            setSectionData((prev) => ({
                              ...prev,
                              employmentStatus: e.target.value,
                            }))
                          }}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="WORKING">Working</option>
                          <option value="STUDYING">Studying</option>
                          <option value="OPEN_TO_WORK">Open to Work</option>
                          <option value="ENTREPRENEUR">Entrepreneur</option>
                          <option value="RETIRED">Retired</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Employment Status
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                          {profile.employmentStatus?.replace('_', ' ') ||
                            'Not Set'}
                        </dd>
                      </div>
                    )}

                    {/* Blood Group */}
                    {editingSection === 'personal' ? (
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Blood Group
                        </label>
                        <select
                          value={
                            sectionData.bloodGroup ||
                            profile.bloodGroup ||
                            ''
                          }
                          onChange={(e) => {
                            setSectionData((prev) => ({
                              ...prev,
                              bloodGroup: e.target.value,
                            }))
                          }}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A_POSITIVE">A+</option>
                          <option value="A_NEGATIVE">A-</option>
                          <option value="B_POSITIVE">B+</option>
                          <option value="B_NEGATIVE">B-</option>
                          <option value="AB_POSITIVE">AB+</option>
                          <option value="AB_NEGATIVE">AB-</option>
                          <option value="O_POSITIVE">O+</option>
                          <option value="O_NEGATIVE">O-</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Blood Group
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                          {profile.bloodGroup ? (
                            profile.bloodGroup
                              .replace('_POSITIVE', '+')
                              .replace('_NEGATIVE', '-')
                              .replace('_', '')
                          ) : 'Not Set'}
                        </dd>
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Basic Details Section - Non-editable for verified information */}
              <SectionCard
                title="Basic Details"
                sectionKey="basic"
                canEdit={false}
                editingSection={editingSection}
                onEditSection={handleEditSection}
                onSaveSection={handleSaveSection}
                onCancelEdit={handleCancelEdit}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SimpleFieldDisplay
                    label="Full Name"
                    value={profile.fullName}
                  />
                  <SimpleFieldDisplay label="Email" value={profile.email} />
                  <SimpleFieldDisplay label="Batch" value={profile.batch} />
                </div>
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      These are verified details and cannot be changed. Contact
                      admin if corrections are needed.
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Right Column */}
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              {/* Contact Information Section - Editable */}
              <SectionCard
                title="Contact Information"
                sectionKey="contact"
                canEdit={true}
                editingSection={editingSection}
                onEditSection={handleEditSection}
                onSaveSection={handleSaveSection}
                onCancelEdit={handleCancelEdit}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* WhatsApp Number */}
                  {editingSection === 'contact' ? (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        value={sectionData.whatsappNumber || profile.whatsappNumber || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10) // Only digits, max 10
                          setSectionData((prev) => ({
                            ...prev,
                            whatsappNumber: value,
                          }))
                        }}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        placeholder="Enter WhatsApp number"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                  ) : (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        WhatsApp Number
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                        {profile.whatsappNumber || 'Not Set'}
                      </dd>
                    </div>
                  )}

                  {/* Alternate Number */}
                  {editingSection === 'contact' ? (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Alternate Number
                      </label>
                      <input
                        type="tel"
                        value={sectionData.alternateNumber || profile.alternateNumber || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10) // Only digits, max 10
                          setSectionData((prev) => ({
                            ...prev,
                            alternateNumber: value,
                          }))
                        }}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        placeholder="Enter alternate number"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                  ) : (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Alternate Number
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                        {profile.alternateNumber || 'Not Set'}
                      </dd>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Social Links Section */}
              <SectionCard 
                title="Social Links" 
                sectionKey="social"
                editingSection={editingSection}
                onEditSection={handleEditSection}
                onSaveSection={handleSaveSection}
                onCancelEdit={handleCancelEdit}
              >
                <div className="space-y-4">
                  <FieldDisplay
                    label="LinkedIn URL"
                    value={profile.linkedinUrl}
                    isEditing={editingSection === 'social'}
                    fieldKey="linkedinUrl"
                    placeholder="https://linkedin.com/in/username"
                    sectionData={sectionData}
                    onFieldChange={handleSectionFieldChange}
                  />
                  <FieldDisplay
                    label="Instagram URL"
                    value={profile.instagramUrl}
                    isEditing={editingSection === 'social'}
                    fieldKey="instagramUrl"
                    placeholder="https://instagram.com/username"
                    sectionData={sectionData}
                    onFieldChange={handleSectionFieldChange}
                  />
                  <FieldDisplay
                    label="Facebook URL"
                    value={profile.facebookUrl}
                    isEditing={editingSection === 'social'}
                    fieldKey="facebookUrl"
                    placeholder="https://facebook.com/username"
                    sectionData={sectionData}
                    onFieldChange={handleSectionFieldChange}
                  />
                  <FieldDisplay
                    label="Twitter URL"
                    value={profile.twitterUrl}
                    isEditing={editingSection === 'social'}
                    fieldKey="twitterUrl"
                    placeholder="https://twitter.com/username"
                    sectionData={sectionData}
                    onFieldChange={handleSectionFieldChange}
                  />
                  <FieldDisplay
                    label="Portfolio URL"
                    value={profile.portfolioUrl}
                    isEditing={editingSection === 'social'}
                    fieldKey="portfolioUrl"
                    placeholder="https://yourportfolio.com"
                    sectionData={sectionData}
                    onFieldChange={handleSectionFieldChange}
                  />
                </div>
              </SectionCard>

            </div>
          </div>
        )}

        {activeTab === 'address' && (
          <div className="space-y-8">
            {/* Address Form */}
            <SectionCard 
              title="Address Information" 
              sectionKey="address"
              editingSection={editingSection}
              onEditSection={handleEditSection}
              onSaveSection={handleSaveSection}
              onCancelEdit={handleCancelEdit}
            >
              <AddressForm 
                addressData={addressData}
                editingSection={editingSection}
                sectionData={sectionData}
                setSectionData={setSectionData}
              />
            </SectionCard>
          </div>
        )}

        {activeTab === 'career' && (
          <div className="space-y-8">
            {/* Education Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <EducationSection 
                educationData={educationData}
              />
            </div>
            
            {/* Work Experience Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <WorkExperienceSection 
                workData={workData}
              />
            </div>
          </div>
        )}

        {activeTab === 'social' && (
          <div className="space-y-8">
            {/* Blood Donation Section */}
            <SectionCard 
              title="Blood Donation Record" 
              sectionKey="bloodDonation"
              editingSection={editingSection}
              onEditSection={handleEditSection}
              onSaveSection={handleSaveSection}
              onCancelEdit={handleCancelEdit}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FieldDisplay
                  label="Blood Donor"
                  value={profile.isBloodDonor}
                  type="checkbox"
                  isEditing={editingSection === 'bloodDonation'}
                  fieldKey="isBloodDonor"
                  sectionData={sectionData}
                  onFieldChange={handleSectionFieldChange}
                />
                <FieldDisplay
                  label="Last Blood Donation Date"
                  value={profile.lastBloodDonationDate ? new Date(profile.lastBloodDonationDate).toLocaleDateString() : null}
                  type="date"
                  isEditing={editingSection === 'bloodDonation'}
                  fieldKey="lastBloodDonationDate"
                  sectionData={sectionData}
                  onFieldChange={handleSectionFieldChange}
                />
                <FieldDisplay
                  label="Total Blood Donations"
                  value={profile.totalBloodDonations}
                  type="text"
                  isEditing={editingSection === 'bloodDonation'}
                  fieldKey="totalBloodDonations"
                  placeholder="0"
                  sectionData={sectionData}
                  onFieldChange={handleSectionFieldChange}
                />
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Documents
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No documents uploaded yet
              </p>
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Assets
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No assets assigned yet
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Spacer */}
      <div className="h-16 md:hidden"></div>

      {/* Alumni Identity Card Modal */}
      <AlumniIdentityCard
        isOpen={showIdentityCard}
        onClose={() => setShowIdentityCard(false)}
        profile={profile}
      />
    </div>
  )
}

export default Profile
