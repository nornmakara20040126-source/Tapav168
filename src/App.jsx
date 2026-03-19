import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Printer, CheckCircle, Circle, Truck, Scissors, Shirt, Package, Tag,
  Clock, User, Phone, FileText, Upload, Image as ImageIcon, Palette,
  Save, History, RefreshCw, Trash2, AlertCircle, Shield, Lock, Search,
  ArrowLeft, LayoutList, Calculator, QrCode, FileDown, Play, CheckSquare,
  X, Menu, Home, PlusCircle, Settings, LogOut, ChevronRight, Eye, Inbox, ArrowRight, ScanLine, AlertTriangle, Camera, Edit3, Grid, Ruler, Box, Send, CornerDownRight
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc, getDoc, getDocs, collection, onSnapshot, deleteDoc, query, orderBy } from "firebase/firestore";

// =====================================================================
// ការកំណត់ Firebase និងការសម្អាត App ID ដើម្បីការពារ Error
// =====================================================================
const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyCDd9XJxAPA5xWf-k6G_ddBCZ9m4kFeMZ0',
  authDomain: 'tapav-taking.firebaseapp.com',
  projectId: 'tapav-taking',
  storageBucket: 'tapav-taking.firebasestorage.app',
  messagingSenderId: '283415310081',
  appId: '1:283415310081:web:7801d86cea35ae665eb500',
  measurementId: 'G-X2DD8KQM2S',
};

let firebaseConfig = fallbackFirebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  }
} catch (e) {
  console.error("Firebase config parsing error:", e);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// បំប្លែង App ID ឱ្យមានសុវត្ថិភាព (លុបសញ្ញា / ចេញដើម្បីការពារ Error Collection Path)
const inferredAppId = firebaseConfig?.appId || firebaseConfig?.projectId || 'default-app-id';
const rawAppId = typeof __app_id !== 'undefined' && __app_id ? String(__app_id) : inferredAppId;
const safeAppId = rawAppId.replace(/[^a-zA-Z0-9_-]/g, '-');
const sharedOrdersCollectionRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'orders');
const sharedOrdersCollectionPath = ['artifacts', safeAppId, 'public', 'data', 'orders'].join('/');
const getSharedOrderDocRef = (poNumber) => doc(sharedOrdersCollectionRef, poNumber);
const getLegacyOrdersCollectionRef = (uid) => collection(db, 'artifacts', safeAppId, 'users', uid, 'orders');

// តួនាទីអ្នកប្រើប្រាស់ (User Roles)
const ROLES = {
  ADMIN: { id: 'admin', label: 'Admin (អ្នកគ្រប់គ្រង)', permissions: 'all' },
  OPERATION: { id: 'operation', label: 'Operation (ប្រតិបត្តិការ)', permissions: ['approve'] },
  STOCK: { id: 'stock', label: '1. ស្តុក (Stock)', permissions: [0] },
  NECK_ARMS: { id: 'neck_arms', label: '2. កនិងចុងដៃ (Neck & Arms)', permissions: [1] },
  CUTTING: { id: 'cutting', label: '3. តុកាត់ (Cutting)', permissions: [2] },
  EMBROIDERY_BACK: { id: 'embroidery_back', label: '4. ប៉ាក់ក្រោយ (Embroidery Back)', permissions: [3] },
  PRINTING_BACK: { id: 'printing_back', label: '5. បោះពុម្ភក្រោយ (Printing Back)', permissions: [4] },
  SEWING: { id: 'sewing', label: '6. ដេរ (Sewing)', permissions: [5] },
  QC: { id: 'qc', label: '7. ត្រួតពិនិត្យ (QC)', permissions: [6] },
  BUTTON: { id: 'button', label: '8. វៃនិងស្រេសឡេវ (Button)', permissions: [7] },
  PRINTING_FRONT: { id: 'printing_front', label: '9. បោះពុម្ភមុខ (Printing Front)', permissions: [8] },
  EMBROIDERY_FRONT: { id: 'embroidery_front', label: '10. ប៉ាក់មុខ (Embroidery Front)', permissions: [9] },
  IRONING_PACK: { id: 'ironing_pack', label: '11. អ៊ុតបត់ច្រក (Ironing & Pack)', permissions: [10] },
  DELIVERY: { id: 'delivery', label: '12. ដឹកជញ្ជូន (Delivery)', permissions: [11] },
};

// ជំហាននៃការផលិត (Production Steps)
const ROLE_PASSWORDS_STORAGE_KEY = 'tshirt_role_passwords';
const DEFAULT_ROLE_PASSWORDS = {
  admin: '123',
  operation: '123',
  stock: '123',
  neck_arms: '123',
  cutting: '123',
  embroidery_back: '123',
  printing_back: '123',
  sewing: '123',
  qc: '123',
  button: '123',
  printing_front: '123',
  embroidery_front: '123',
  ironing_pack: '123',
  delivery: '123',
};

const getRolePasswords = () => {
  if (typeof window === 'undefined') return DEFAULT_ROLE_PASSWORDS;
  try {
    const raw = window.localStorage.getItem(ROLE_PASSWORDS_STORAGE_KEY);
    if (!raw) return DEFAULT_ROLE_PASSWORDS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_ROLE_PASSWORDS;
    return { ...DEFAULT_ROLE_PASSWORDS, ...parsed };
  } catch {
    return DEFAULT_ROLE_PASSWORDS;
  }
};

const STEPS = [
  { id: 1, label: '1. ស្តុក (Stock)', icon: Box, role: 'stock' },
  { id: 2, label: '2. កនិងចុងដៃ (Neck & Arms)', icon: Shirt, role: 'neck_arms' },
  { id: 3, label: '3. តុកាត់ (Cutting)', icon: Scissors, role: 'cutting' },
  { id: 4, label: '4. ប៉ាក់ក្រោយ (Embroidery Back)', icon: Palette, role: 'embroidery_back' },
  { id: 5, label: '5. បោះពុម្ភក្រោយ (Printing Back)', icon: Printer, role: 'printing_back' },
  { id: 6, label: '6. ដេរ (Sewing)', icon: Shirt, role: 'sewing' },
  { id: 7, label: '7. ត្រួតពិនិត្យ (QC)', icon: CheckCircle, role: 'qc' },
  { id: 8, label: '8. វៃនិងស្រេសឡេវ (Button)', icon: Circle, role: 'button' },
  { id: 9, label: '9. បោះពុម្ភមុខ (Printing Front)', icon: Printer, role: 'printing_front' },
  { id: 10, label: '10. ប៉ាក់មុខ (Embroidery Front)', icon: Palette, role: 'embroidery_front' },
  { id: 11, label: '11. អ៊ុតបត់ច្រក (Ironing & Pack)', icon: Package, role: 'ironing_pack' },
  { id: 12, label: '12. ដឹកជញ្ជូន (Delivery)', icon: Truck, role: 'delivery' },
];

// ពណ៌អាវ (Shirt Colors)
const PRESET_COLORS = [
  { name: 'ស', value: '#FFFFFF', border: 'border-gray-200' },
  { name: 'ខ្មៅ', value: '#1F2937', border: 'border-gray-800' },
  { name: 'ក្រហម', value: '#EF4444', border: 'border-red-600' },
  { name: 'ខៀវ', value: '#3B82F6', border: 'border-blue-600' },
  { name: 'លឿង', value: '#EAB308', border: 'border-yellow-600' },
  { name: 'បៃតង', value: '#22C55E', border: 'border-green-600' },
  { name: 'ទឹកក្រូច', value: '#F97316', border: 'border-orange-600' },
  { name: 'ប្រផេះ', value: '#6B7280', border: 'border-gray-500' },
];

const STYLE_OPTIONS = [
  "IND(1)", "IND(2)", "IND IAA", "3 INIAA", "3S",
  "2S", "BD", "BONG TAI", "XDT", "1S",
  "3 MM(1)", "4 M", "3 MM", "2MM", "3 M"
];

const DEFAULT_SPECS = {
  colorValue: PRESET_COLORS[0].value,
  colorName: PRESET_COLORS[0].name,
  styleOption: 'IND(1)',
  collarType: '',
  placketType: '',
  cuffStripe: '',
  fabricType: '',
  logoFrontSize: '',
  logoBackSize: '',
  logoColor: '',
  description: '',
  technicalNotes: '',
};

const MAX_UPLOAD_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const FIRESTORE_DOC_SAFE_LIMIT_BYTES = 950000;
const DEFAULT_IMAGE_DATA_URL_TARGET_BYTES = 190 * 1024;
const SAVE_RECOVERY_IMAGE_DATA_URL_TARGET_BYTES = 130 * 1024;
const MAX_COMPRESSED_IMAGE_MAX_SIDE = 1600;
const MIN_COMPRESSED_IMAGE_MAX_SIDE = 720;
const MIN_COMPRESSED_IMAGE_QUALITY = 0.45;

const getByteSize = (value) => new Blob([value]).size;

const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
  reader.readAsDataURL(file);
});

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to load image.'));
  image.src = src;
});

const fitImageWithinMaxSide = (width, height, maxSide) => {
  const longest = Math.max(width, height);
  if (!longest || longest <= maxSide) {
    return { width, height };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const encodeImageAsJpegDataURL = (image, width, height, quality) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }
  // Keep transparent source images readable after JPEG conversion.
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
};

const compressImageSourceForFirestore = async (imageSource, targetBytes = DEFAULT_IMAGE_DATA_URL_TARGET_BYTES) => {
  const image = await loadImageElement(imageSource);
  let { width, height } = fitImageWithinMaxSide(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    MAX_COMPRESSED_IMAGE_MAX_SIDE
  );

  let quality = 0.86;
  let compressedImage = encodeImageAsJpegDataURL(image, width, height, quality);
  let compressedSize = getByteSize(compressedImage);

  const lowerQuality = () => {
    while (compressedSize > targetBytes && quality > MIN_COMPRESSED_IMAGE_QUALITY) {
      quality = Math.max(MIN_COMPRESSED_IMAGE_QUALITY, quality - 0.08);
      compressedImage = encodeImageAsJpegDataURL(image, width, height, quality);
      compressedSize = getByteSize(compressedImage);
      if (quality === MIN_COMPRESSED_IMAGE_QUALITY) break;
    }
  };

  lowerQuality();

  while (compressedSize > targetBytes && Math.max(width, height) > MIN_COMPRESSED_IMAGE_MAX_SIDE) {
    const currentMaxSide = Math.max(width, height);
    const nextMaxSide = Math.max(Math.round(currentMaxSide * 0.88), MIN_COMPRESSED_IMAGE_MAX_SIDE);
    const scale = nextMaxSide / currentMaxSide;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    quality = Math.min(quality, 0.82);
    compressedImage = encodeImageAsJpegDataURL(image, width, height, quality);
    compressedSize = getByteSize(compressedImage);
    lowerQuality();
  }

  return compressedImage;
};

const hasOwnEnvVar = (key) =>
  typeof import.meta !== 'undefined' &&
  !!import.meta.env &&
  Object.prototype.hasOwnProperty.call(import.meta.env, key);

const TELEGRAM_PROXY_URL =
  typeof import.meta !== 'undefined'
    ? hasOwnEnvVar('VITE_TELEGRAM_PROXY_URL')
      ? String(import.meta.env.VITE_TELEGRAM_PROXY_URL || '').trim()
      : '/telegram/send'
    : '/telegram/send';

const TELEGRAM_ROLE_CHAT_IDS =
  typeof import.meta !== 'undefined'
    ? (() => {
      try {
        const raw = import.meta.env?.VITE_TELEGRAM_ROLE_CHAT_IDS || '{}';
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        console.warn('Invalid VITE_TELEGRAM_ROLE_CHAT_IDS JSON:', error);
        return {};
      }
    })()
    : {};

const PO_NUMBER_PATTERN = /^PO(\d{5})$/i;
const formatPONumber = (sequence) => `PO${String(sequence).padStart(5, '0')}`;

const getNextPONumber = (orders = []) => {
  const maxSequence = (orders || []).reduce((max, order) => {
    const poNumber = String(order?.orderInfo?.poNumber || '').trim();
    const matched = poNumber.match(PO_NUMBER_PATTERN);
    if (!matched) return max;
    const sequence = parseInt(matched[1], 10);
    if (!Number.isFinite(sequence)) return max;
    return Math.max(max, sequence);
  }, 0);

  return formatPONumber(maxSequence + 1);
};

const EMPTY_CONFIRM_DIALOG = {
  show: false,
  title: '',
  message: '',
  onConfirm: null,
  isDangerous: false,
  nextRoleOptions: [],
  selectedNextRole: '',
};

const sanitizeForFirestore = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeForFirestore);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitizeForFirestore(v)])
    );
  }
  return value;
};

// Helper: Format Date
const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('km-KH') + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// Login Screen Component
const LoginScreen = ({ onLogin, authError }) => {
  const [selectedRole, setSelectedRole] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const selectedRoleInfo = Object.values(ROLES).find((role) => role.id === selectedRole);

  const submitLogin = () => {
    const ok = onLogin(selectedRole, password);
    if (!ok) {
      setLoginError('Invalid password for selected role.');
      return;
    }
    setLoginError('');
    setPassword('');
  };

  useEffect(() => {
    setLoginError('');
    setPassword('');
  }, [selectedRole]);

  return (
    <div className="min-h-screen bg-slate-100 relative overflow-hidden font-sans">
      <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-blue-200/70 blur-3xl" />
      <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-cyan-200/70 blur-3xl" />

      <div className="relative min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl bg-white/95 backdrop-blur rounded-3xl border border-slate-200 shadow-2xl overflow-hidden grid md:grid-cols-[1.05fr_1fr]">
          <section className="hidden md:flex flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white p-10">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mb-6">
                <Shirt size={34} />
              </div>
              <h1 className="text-4xl font-extrabold leading-tight">Production Manager</h1>
              <p className="mt-3 text-blue-100 text-sm">Secure access for each department role.</p>
            </div>

            <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
              <p className="text-xs uppercase tracking-widest text-blue-100">Selected Role</p>
              <p className="mt-1 font-bold text-lg">{selectedRoleInfo?.label}</p>
            </div>
          </section>

          <section className="p-6 md:p-10">
            <div className="mb-7">
              <h2 className="text-3xl font-black text-slate-800">Sign In</h2>
              <p className="text-slate-500 mt-1 text-sm">Choose your role and enter password.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3">Role</label>
              <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                {Object.values(ROLES).map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    className={`w-full p-3 rounded-xl text-sm border-2 transition-all flex items-center gap-3 text-left
                      ${selectedRole === role.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                  >
                    <div className={`p-2 rounded-full ${selectedRole === role.id ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <Shield size={18} className={selectedRole === role.id ? 'text-blue-600' : 'text-slate-400'} />
                    </div>
                    <span className="flex-1 font-semibold">{role.label}</span>
                    {selectedRole === role.id && <CheckCircle size={18} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitLogin()}
                  className="w-full p-3 pr-20 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-0 outline-none"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {loginError && <p className="text-xs text-red-600 mt-2">{loginError}</p>}
              {authError && <p className="text-xs text-red-600 mt-2">{authError}</p>}
            </div>

            <button
              onClick={submitLogin}
              className="mt-6 w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowRight size={16} />
                Login
              </span>
            </button>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">&copy; 2024 T-Shirt Factory System</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// T-Shirt SVG Component
const TShirtMockup = ({ uploadedImage, color }) => {
  if (uploadedImage) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <img src={uploadedImage} className="max-h-full max-w-full object-contain p-2" crossOrigin="anonymous" />
      </div>
    );
  }

  // System SVG (Simplified)
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 240 300" className="w-full h-full drop-shadow-lg" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
        <path d="M75,50 L95,70 L115,50 L200,50 L220,100 L180,120 L180,280 L60,280 L60,120 L20,100 L40,50 Z" fill={color || '#FFFFFF'} stroke="#333" strokeWidth="2" />
        <path d="M95,50 Q120,80 145,50" fill="none" stroke="#333" strokeWidth="2" />
        <line x1="60" y1="120" x2="60" y2="280" stroke="none" />
        <line x1="180" y1="120" x2="180" y2="280" stroke="none" />
      </svg>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentRole, setCurrentRole] = useState(ROLES.ADMIN);
  const [saving, setSaving] = useState(false);
  const [savedOrders, setSavedOrders] = useState([]);
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [listFilter, setListFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Printing & Modal States
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const contentRef = useRef(null);
  const [receiveModal, setReceiveModal] = useState({ show: false, order: null, stepIndex: null, quantity: 0, sizes: {} });
  const [confirmDialog, setConfirmDialog] = useState({ ...EMPTY_CONFIRM_DIALOG });
  // Operation Approve Modal
  const [approveModal, setApproveModal] = useState({ show: false, order: null, startStep: 0 });
  const [showScanner, setShowScanner] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const searchInputRef = useRef(null);
  const migratedLegacyUidsRef = useRef(new Set());
  const closeConfirmDialog = () => setConfirmDialog({ ...EMPTY_CONFIRM_DIALOG });

  const [orderInfo, setOrderInfo] = useState({
    customer: '', phone: '', date: new Date().toISOString().split('T')[0],
    deadline: '', poNumber: '',
    quantity: 0,
    status: 'pending_operation',
    startStep: 0,
    sizes: {
      male: { 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'XXXL': 0 },
      female: { 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'XXXL': 0 },
      kids_male: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0 },
      kids_female: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0 }
    }
  });

  const [stepsData, setStepsData] = useState({});
  const [specs, setSpecs] = useState({ ...DEFAULT_SPECS });

  const [imageCount, setImageCount] = useState(1);
  const [uploadedImages, setUploadedImages] = useState(Array(1).fill(null));
  const [mockupMode, setMockupMode] = useState('svg');

  const isAdmin = currentRole.id === 'admin';
  const isOperation = currentRole.id === 'operation';

  // --- Inject scripts for PDF and QR Code ---
  useEffect(() => {
    const scriptPDF = document.createElement('script');
    scriptPDF.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    scriptPDF.async = true;
    document.body.appendChild(scriptPDF);

    const scriptQR = document.createElement('script');
    scriptQR.src = "https://unpkg.com/html5-qrcode";
    scriptQR.async = true;
    document.body.appendChild(scriptQR);

    return () => {
      if (document.body.contains(scriptPDF)) document.body.removeChild(scriptPDF);
      if (document.body.contains(scriptQR)) document.body.removeChild(scriptQR);
    }
  }, []);

  // --- Auth & Data Loading ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        setAuthError('');
      } catch (error) {
        console.error('Firebase auth failed:', error);
        const message = error?.message || 'Firebase sign-in failed. Check internet or authorized domains.';
        setAuthError(message);
        showNotification(`Firebase sign-in failed: ${message}`, 'error');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    if (migratedLegacyUidsRef.current.has(user.uid)) return;

    migratedLegacyUidsRef.current.add(user.uid);

    const migrateLegacyOrders = async () => {
      try {
        const legacyOrdersRef = getLegacyOrdersCollectionRef(user.uid);
        const [legacySnapshot, sharedSnapshot] = await Promise.all([
          getDocs(legacyOrdersRef),
          getDocs(sharedOrdersCollectionRef),
        ]);

        if (legacySnapshot.empty) return;

        const sharedIds = new Set(sharedSnapshot.docs.map((snapshotDoc) => snapshotDoc.id));
        const legacyOrdersToCopy = legacySnapshot.docs.filter((snapshotDoc) => !sharedIds.has(snapshotDoc.id));

        if (!legacyOrdersToCopy.length) return;

        await Promise.all(
          legacyOrdersToCopy.map((snapshotDoc) =>
            setDoc(getSharedOrderDocRef(snapshotDoc.id), snapshotDoc.data(), { merge: true })
          )
        );

        showNotification(`Migrated ${legacyOrdersToCopy.length} old order(s) to the shared database.`, 'info');
      } catch (error) {
        console.error('Legacy order migration failed:', error);
      }
    };

    void migrateLegacyOrders();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // ប្រើ safeAppId ដើម្បីការពារកុំអោយ Error
    const q = query(sharedOrdersCollectionRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      orders.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      setSavedOrders(orders);

      const currentActiveOrder = orders.find(o => o.orderInfo.poNumber === orderInfo.poNumber);
      if (currentActiveOrder && viewMode === 'form') {
        setStepsData(currentActiveOrder.stepsData || {});
        if (currentActiveOrder.orderInfo) {
          setOrderInfo(prev => ({
            ...prev,
            status: currentActiveOrder.orderInfo.status,
            startStep: currentActiveOrder.orderInfo.startStep || 0
          }));
        }
      }
    }, (error) => {
      console.error("Error fetching:", error);
      if (error?.code === 'permission-denied') {
        showNotification(`Read blocked by Firestore rules (permission-denied). path=${sharedOrdersCollectionPath}`, 'error');
      } else {
        showNotification(`Database read failed: ${error?.message || 'Unknown error'}`, 'error');
      }
    });
    return () => unsubscribe();
  }, [user, orderInfo.poNumber, viewMode]);

  useEffect(() => {
    let total = 0;
    if (orderInfo.sizes.male) total += Object.values(orderInfo.sizes.male).reduce((a, b) => a + (parseInt(b) || 0), 0);
    if (orderInfo.sizes.female) total += Object.values(orderInfo.sizes.female).reduce((a, b) => a + (parseInt(b) || 0), 0);
    if (orderInfo.sizes.kids_male) total += Object.values(orderInfo.sizes.kids_male).reduce((a, b) => a + (parseInt(b) || 0), 0);
    if (orderInfo.sizes.kids_female) total += Object.values(orderInfo.sizes.kids_female).reduce((a, b) => a + (parseInt(b) || 0), 0);
    setOrderInfo(prev => ({ ...prev, quantity: total }));
  }, [orderInfo.sizes]);

  // --- Scanner Logic ---
  useEffect(() => {
    let html5QrcodeScanner;
    if (showScanner && window.Html5QrcodeScanner) {
      setTimeout(() => {
        html5QrcodeScanner = new window.Html5QrcodeScanner(
          "reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false
        );
        html5QrcodeScanner.render((decodedText) => {
          setSearchTerm(decodedText);
          setShowScanner(false);
          showNotification(`បានស្កេន: ${decodedText}`, "success");
          html5QrcodeScanner.clear();
        }, (errorMessage) => { });
      }, 100);
    }
    return () => {
      if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(error => console.error("Failed to clear html5QrcodeScanner. ", error));
    };
  }, [showScanner]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeDrawerOnEscape = (event) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    const closeDrawerOnDesktop = () => {
      if (window.innerWidth >= 768) setMobileNavOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeDrawerOnEscape);
    window.addEventListener('resize', closeDrawerOnDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeDrawerOnEscape);
      window.removeEventListener('resize', closeDrawerOnDesktop);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [viewMode, listFilter]);

  // --- Handlers ---
  const handleLogin = (roleId, password) => {
    const newRole = Object.values(ROLES).find(r => r.id === roleId);
    if (!newRole) return false;

    const rolePasswords = getRolePasswords();
    const expectedPassword = String(rolePasswords[newRole.id] ?? '');
    if (String(password ?? '') !== expectedPassword) {
      return false;
    }

    setCurrentRole(newRole);
    setIsLoggedIn(true);
    if (newRole.id === 'admin' || newRole.id === 'operation') {
      setListFilter('all');
    } else {
      setListFilter('my_tasks');
    }
    setViewMode('list');
    showNotification(`សូមស្វាគមន៍, ${newRole.label}`, 'success');
    return true;
  };

  const handleLogout = () => {
    setMobileNavOpen(false);
    setIsLoggedIn(false);
    setCurrentRole(ROLES.ADMIN);
    setViewMode('list');
  };

  const handleDownloadPDF = async () => {
    if (!window.html2pdf) {
      showNotification("PDF generator is still loading. Please try again.", "warning");
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // Ensure Khmer web font is loaded before html2canvas captures content.
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      const element = contentRef.current;
      const opt = {
        margin: 5,
        filename: `${orderInfo.poNumber}_${orderInfo.customer}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await window.html2pdf().set(opt).from(element).save();
      showNotification("Downloaded PDF successfully.", "success");
    } catch (err) {
      console.error(err);
      showNotification("Failed to generate PDF.", "error");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const sendTelegramNotification = async (text, { chatId } = {}) => {
    if (!TELEGRAM_PROXY_URL || !text) return;
    try {
      const payload = { text };
      if (chatId) payload.chat_id = String(chatId);
      await fetch(TELEGRAM_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Telegram notification failed:', error);
    }
  };

  const sendTelegramToRoles = async (roleIds, text) => {
    const uniqueRoles = [...new Set((roleIds || []).filter(Boolean))];
    let sentToRoleChat = false;

    for (const roleId of uniqueRoles) {
      const chatId = TELEGRAM_ROLE_CHAT_IDS?.[roleId];
      if (!chatId) continue;
      sentToRoleChat = true;
      await sendTelegramNotification(text, { chatId });
    }

    // Fallback to default TELEGRAM_CHAT_ID from proxy when no role mapping exists.
    if (!sentToRoleChat) {
      await sendTelegramNotification(text);
    }
  };

  const TELEGRAM_EVENT_META = {
    'Order Saved': { emoji: '📥', title: 'បានរក្សាទុកអូដឺរ' },
    'Order Approved to Production': { emoji: '🚀', title: 'បញ្ជូនការងារទៅផលិតកម្ម' },
    'Step Received': { emoji: '📬', title: 'បានទទួលការងារ' },
    'Step Completed': { emoji: '✅', title: 'បានបញ្ចប់ការងារ' },
  };

  const buildOrderTelegramMessage = ({
    event,
    poNumber,
    customer,
    quantity,
    role,
    stepLabel,
    note,
  }) => {
    const eventMeta = TELEGRAM_EVENT_META[event] || { emoji: '📣', title: event || 'សេចក្តីជូនដំណឹង' };
    const roleLabel =
      Object.values(ROLES).find((r) => r.id === role)?.label?.split(' (')[0] || role || '-';
    const timeText = new Date().toLocaleString('km-KH', { hour12: false });

    const lines = [
      `${eventMeta.emoji} ${eventMeta.title}`,
      '━━━━━━━━━━━━━━━━━━',
      `📌 លេខ PO៖ ${poNumber || '-'}`,
      `👤 អតិថិជន៖ ${customer || '-'}`,
      `🔢 ចំនួន៖ ${quantity ?? '-'} pcs`,
      `👷 តួនាទី៖ ${roleLabel}`,
      stepLabel ? `🧭 ជំហាន៖ ${stepLabel}` : '',
      note ? `📝 ចំណាំ៖ ${note}` : '',
      `🕒 ពេលវេលា៖ ${timeText}`,
    ].filter(Boolean);
    return lines.join('\n');
  };
  const hasPermission = (stepIndex) => {
    if (currentRole.id === 'admin' || currentRole.id === 'operation') return false;
    return currentRole.permissions.includes(stepIndex);
  };

  // --- OPERATION: Approve Order Logic ---
  const openApproveModal = (order) => {
    setApproveModal({ show: true, order, startStep: 0 });
  };

  const confirmApproveOrder = async () => {
    const { order, startStep } = approveModal;
    if (!user || !order) return;

    try {
      const updatedOrderInfo = {
        ...order.orderInfo,
        status: 'production',
        startStep: parseInt(startStep)
      };

      await setDoc(getSharedOrderDocRef(order.orderInfo.poNumber), {
        ...order,
        orderInfo: updatedOrderInfo
      }, { merge: true });

      if (orderInfo.poNumber === order.orderInfo.poNumber) {
        setOrderInfo(updatedOrderInfo);
      }

      setApproveModal({ show: false, order: null, startStep: 0 });
      const startRoleId = STEPS[parseInt(startStep)]?.role;
      void sendTelegramToRoles(
        [currentRole.id, startRoleId],
        buildOrderTelegramMessage({
          event: 'Order Approved to Production',
          poNumber: updatedOrderInfo.poNumber,
          customer: updatedOrderInfo.customer,
          quantity: updatedOrderInfo.quantity,
          role: currentRole.id,
          note: `ចាប់ផ្តើមពីជំហាន ${parseInt(startStep) + 1}`,
        })
      );
      showNotification("Order បានអនុម័ត និងបញ្ជូនទៅផ្នែកផលិត!", 'success');
    } catch (error) {
      console.error(error);
      showNotification("បរាជ័យក្នុងការអនុម័ត", 'error');
    }
  };

  // --- WORKFLOW LOGIC ---
  const isStepReady = (stepIndex, sData, startStep = 0) => {
    if (stepIndex < startStep) return false;
    if (stepIndex === startStep) return true;
    const prevStepStatus = sData[stepIndex - 1]?.status;
    if (prevStepStatus === 'completed') return true;
    return Object.values(sData).some((step) => step?.status === 'completed' && step?.nextStepIndex === stepIndex);
  };

  const filteredOrders = savedOrders.filter(order => {
    const matchesSearch = order.orderInfo.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderInfo.poNumber.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const status = order.orderInfo.status || 'pending_operation';
    const sData = order.stepsData || {};
    const startStep = order.orderInfo.startStep || 0;

    if (isAdmin || isOperation) {
      if (listFilter === 'my_tasks' && isOperation) return status === 'pending_operation';
      if (listFilter === 'history' && isOperation) return status === 'production';
      return true;
    }

    if (status !== 'production') return false;

    if (listFilter === 'my_tasks') {
      return STEPS.some((step, index) => {
        const isMyRole = currentRole.permissions.includes(index);
        const isPending = !sData[index] || sData[index].status === 'pending';
        const ready = isStepReady(index, sData, startStep);
        const isInProgress = sData[index] && sData[index].status === 'in_progress';
        return isMyRole && ((isPending && ready) || isInProgress);
      });
    }

    if (listFilter === 'history') {
      return STEPS.some((step, index) => {
        const isMyRole = currentRole.permissions.includes(index);
        const isCompleted = sData[index]?.status === 'completed';
        return isMyRole && isCompleted;
      });
    }

    return true;
  });

  const pendingTasksCount = useMemo(() => {
    if (isAdmin) return 0;
    if (isOperation) {
      return savedOrders.filter(o => !o.orderInfo.status || o.orderInfo.status === 'pending_operation').length;
    }
    return savedOrders.filter(order => {
      if (order.orderInfo.status !== 'production') return false;
      const sData = order.stepsData || {};
      const startStep = order.orderInfo.startStep || 0;
      return STEPS.some((step, index) => {
        const isMyRole = currentRole.permissions.includes(index);
        const isPending = !sData[index] || sData[index].status === 'pending';
        const ready = isStepReady(index, sData, startStep);
        return isMyRole && isPending && ready;
      });
    }).length;
  }, [savedOrders, currentRole, isAdmin, isOperation]);

  const currentRoleLabel = currentRole.label.split(' (')[0];
  const listTitle =
    listFilter === 'my_tasks'
      ? 'ការងាររង់ចាំខ្ញុំ (My Inbox)'
      : listFilter === 'history'
        ? 'ប្រវត្តិការងារ (History)'
        : 'បញ្ជីការកុម្ម៉ង់ (All Orders)';
  const listDescription =
    listFilter === 'my_tasks'
      ? `មាន ${filteredOrders.length} ការងារដែលត្រូវធ្វើ`
      : 'គ្រប់គ្រងការផលិតទាំងអស់';
  const mobileViewTitle =
    viewMode === 'form'
      ? (orderInfo.poNumber ? `Order ${orderInfo.poNumber}` : 'បង្កើតការកុម្ម៉ង់')
      : listFilter === 'my_tasks'
        ? 'ការងារខ្ញុំ'
        : listFilter === 'history'
          ? 'ប្រវត្តិ'
          : 'ការកុម្ម៉ង់ទាំងអស់';

  const getOrderStatusMeta = (order) => {
    const status = order.orderInfo.status || 'pending_operation';
    if (status === 'pending_operation') {
      return {
        label: 'រង់ចាំ Operation',
        className: 'bg-purple-50 text-purple-700',
      };
    }

    const sData = order.stepsData || {};
    let lastStepIndex = -1;

    Object.keys(sData).forEach((key) => {
      const index = parseInt(key, 10);
      if (Number.isFinite(index)) {
        lastStepIndex = Math.max(lastStepIndex, index);
      }
    });

    if (lastStepIndex === -1) {
      return {
        label: 'កំពុងផលិត',
        className: 'bg-blue-50 text-blue-700',
      };
    }

    return {
      label: STEPS[lastStepIndex]?.label || 'កំពុងដំណើរការ',
      className: sData[lastStepIndex]?.status === 'completed'
        ? 'bg-green-50 text-green-700'
        : 'bg-yellow-50 text-yellow-700',
    };
  };

  const openReceiveModal = (order, stepIndex) => {
    const sData = order.stepsData || {};
    let defaultSizes = {
      male: { ...order.orderInfo.sizes.male },
      female: { ...order.orderInfo.sizes.female },
      kids_male: { ...order.orderInfo.sizes.kids_male },
      kids_female: { ...order.orderInfo.sizes.kids_female },
    };
    let defaultQty = order.orderInfo.quantity;

    if (stepIndex > 0 && sData[stepIndex - 1]?.receivedSizes) {
      defaultSizes = sData[stepIndex - 1].receivedSizes;
      defaultQty = sData[stepIndex - 1].quantity;
    }

    setReceiveModal({ show: true, order: order, stepIndex: stepIndex, quantity: defaultQty, sizes: defaultSizes });
  };

  const updateReceiveModalSize = (category, size, value) => {
    const newSizes = {
      ...receiveModal.sizes,
      [category]: { ...receiveModal.sizes[category], [size]: parseInt(value) || 0 }
    };

    let newTotal = 0;
    if (newSizes.male) newTotal += Object.values(newSizes.male).reduce((a, b) => a + b, 0);
    if (newSizes.female) newTotal += Object.values(newSizes.female).reduce((a, b) => a + b, 0);
    if (newSizes.kids_male) newTotal += Object.values(newSizes.kids_male).reduce((a, b) => a + b, 0);
    if (newSizes.kids_female) newTotal += Object.values(newSizes.kids_female).reduce((a, b) => a + b, 0);

    setReceiveModal(prev => ({ ...prev, sizes: newSizes, quantity: newTotal }));
  };

  const confirmReceive = async () => {
    const { order, stepIndex, quantity, sizes } = receiveModal;
    if (!user || !order) return;

    const updatedStepsData = {
      ...(order.stepsData || {}),
      [stepIndex]: {
        status: 'in_progress',
        quantity: parseInt(quantity),
        receivedSizes: sizes,
        receivedAt: new Date().toISOString(),
        receivedBy: currentRole.label.split(' (')[0]
      }
    };

    if (viewMode === 'form' && orderInfo.poNumber === order.orderInfo.poNumber) {
      setStepsData(updatedStepsData);
    }

    setReceiveModal({ show: false, order: null, stepIndex: null, quantity: 0, sizes: {} });

    try {
      await setDoc(getSharedOrderDocRef(order.orderInfo.poNumber), {
        ...order, stepsData: updatedStepsData
      }, { merge: true });
      void sendTelegramToRoles(
        [currentRole.id],
        buildOrderTelegramMessage({
          event: 'Step Received',
          poNumber: order.orderInfo?.poNumber,
          customer: order.orderInfo?.customer,
          quantity,
          role: currentRole.id,
          stepLabel: STEPS[stepIndex]?.label,
        })
      );
      showNotification(`បានទទួលការងារ (${quantity} pcs)`, 'success');
    } catch (error) { showNotification("បរាជ័យក្នុងការ Update (Error Saving)", 'error'); }
  };

  const openConfirmComplete = (order, stepIndex) => {
    const sData = order.stepsData || {};
    const nextRoleOptions = STEPS
      .map((step, index) => ({ ...step, index }))
      .filter((step) => step.index > stepIndex && (sData[step.index]?.status || 'pending') === 'pending');

    setConfirmDialog({
      show: true,
      title: 'Finish this step?',
      message: 'Confirm completion and choose the next role.',
      onConfirm: (selectedNextRoleId) => performComplete(order, stepIndex, selectedNextRoleId),
      isDangerous: false,
      nextRoleOptions,
      selectedNextRole: nextRoleOptions[0]?.role || ''
    });
  };

  const performComplete = async (order, stepIndex, selectedNextRoleId = '') => {
    if (!user || !order) return;
    const sData = order.stepsData || {};
    const selectedNextStepIndex = STEPS.findIndex((step) => step.role === selectedNextRoleId);
    const fallbackNextStepIndex = STEPS.findIndex(
      (step, index) => index > stepIndex && (sData[index]?.status || 'pending') === 'pending'
    );
    const effectiveNextStepIndex = selectedNextStepIndex > stepIndex ? selectedNextStepIndex : fallbackNextStepIndex;
    const nextRoleId = effectiveNextStepIndex >= 0 ? STEPS[effectiveNextStepIndex]?.role : '';
    const completedAt = new Date().toISOString();
    const updatedStepsData = {
      ...sData,
      [stepIndex]: {
        ...sData[stepIndex],
        status: 'completed',
        completedAt,
        nextRoleId: nextRoleId || null,
        nextStepIndex: effectiveNextStepIndex >= 0 ? effectiveNextStepIndex : null,
      }
    };

    if (effectiveNextStepIndex >= 0 && !updatedStepsData[effectiveNextStepIndex]) {
      updatedStepsData[effectiveNextStepIndex] = { status: 'pending' };
    }

    if (viewMode === 'form' && orderInfo.poNumber === order.orderInfo.poNumber) {
      setStepsData(updatedStepsData);
    }

    try {
      await setDoc(getSharedOrderDocRef(order.orderInfo.poNumber), {
        ...order, stepsData: updatedStepsData
      }, { merge: true });
      void sendTelegramToRoles(
        [currentRole.id, nextRoleId],
        buildOrderTelegramMessage({
          event: 'Step Completed',
          poNumber: order.orderInfo?.poNumber,
          customer: order.orderInfo?.customer,
          quantity: sData[stepIndex]?.quantity ?? order.orderInfo?.quantity,
          role: currentRole.id,
          stepLabel: STEPS[stepIndex]?.label,
        })
      );
      showNotification('Step completed successfully!', 'success');
    } catch (error) {
      showNotification('Failed to update step.', 'error');
    }
    closeConfirmDialog();
  };

  const handleSave = async () => {
    if (!user) { showNotification("Please wait for login, then try Save again.", "warning"); return; }
    setSaving(true);
    try {
      const finalOrderInfo = { ...orderInfo };
      if (!finalOrderInfo.poNumber) finalOrderInfo.poNumber = getNextPONumber(savedOrders);
      if (!finalOrderInfo.status) finalOrderInfo.status = 'pending_operation';
      if (finalOrderInfo.startStep === undefined) finalOrderInfo.startStep = 0;

      const buildOrderData = (images) => sanitizeForFirestore({
        orderInfo: finalOrderInfo,
        specs,
        mockupMode,
        stepsData,
        uploadedImages: images,
        imageCount,
        savedAt: new Date().toISOString()
      });

      let imagesToSave = uploadedImages;
      let orderData = buildOrderData(imagesToSave);
      let jsonSize = getByteSize(JSON.stringify(orderData));

      if (jsonSize > FIRESTORE_DOC_SAFE_LIMIT_BYTES && imagesToSave.some(Boolean)) {
        const recompressedImages = await Promise.all(
          imagesToSave.map(async (image) => {
            if (!image) return image;
            return compressImageSourceForFirestore(image, SAVE_RECOVERY_IMAGE_DATA_URL_TARGET_BYTES);
          })
        );
        const recompressedOrderData = buildOrderData(recompressedImages);
        const recompressedJsonSize = getByteSize(JSON.stringify(recompressedOrderData));
        if (recompressedJsonSize < jsonSize) {
          imagesToSave = recompressedImages;
          orderData = recompressedOrderData;
          jsonSize = recompressedJsonSize;
          setUploadedImages(recompressedImages);
        }
      }

      if (jsonSize > FIRESTORE_DOC_SAFE_LIMIT_BYTES) {
        showNotification("Cannot Save: data/images too large (>950KB).", 'error');
        return;
      }

      const savePath = `${sharedOrdersCollectionPath}/${finalOrderInfo.poNumber}`;
      await setDoc(getSharedOrderDocRef(finalOrderInfo.poNumber), orderData);
      console.log("Saved to:", savePath);
      void sendTelegramToRoles(
        [currentRole.id],
        buildOrderTelegramMessage({
          event: 'Order Saved',
          poNumber: finalOrderInfo.poNumber,
          customer: finalOrderInfo.customer,
          quantity: finalOrderInfo.quantity,
          role: currentRole.id,
        })
      );
      showNotification("Saved successfully");
      setViewMode('list');
    } catch (error) {
      console.error("Save failed:", error);
      if (error?.code === 'permission-denied') {
        showNotification(`Save blocked by Firestore rules (permission-denied). path=${sharedOrdersCollectionPath}`, 'error');
      } else {
        showNotification(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
      }
    } finally { setSaving(false); }
  };

  const handleLoad = (order) => {
    let loadedOrderInfo = { ...order.orderInfo };
    if (!loadedOrderInfo.sizes.male) {
      loadedOrderInfo.sizes = {
        male: { 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'XXXL': 0 },
        female: { 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'XXXL': 0 },
        kids_male: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0 },
        kids_female: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0 }
      };
    }
    setOrderInfo(loadedOrderInfo);
    const mergedSpecs = { ...DEFAULT_SPECS, ...(order.specs || {}) };
    if (!mergedSpecs.colorName) {
      const matchedColor = PRESET_COLORS.find((c) => c.value === mergedSpecs.colorValue);
      mergedSpecs.colorName = matchedColor?.name || '';
    }
    setSpecs(mergedSpecs);
    if (order.uploadedImages && Array.isArray(order.uploadedImages)) {
      setUploadedImages(order.uploadedImages); setImageCount(order.imageCount || order.uploadedImages.length);
    } else {
      setUploadedImages([null]); setImageCount(1);
    }
    setStepsData(order.stepsData || {});
    setMobileNavOpen(false);
    setViewMode('form');
  };

  const handleDelete = (poNumber, e) => {
    e.stopPropagation();
    if (currentRole.id !== 'admin') { showNotification("Admin Only", 'warning'); return; }
    setConfirmDialog({
      show: true, title: 'លុប Order?', message: 'តើអ្នកពិតជាចង់លុប Order នេះមែនទេ?',
      onConfirm: async () => {
        try {
          await deleteDoc(getSharedOrderDocRef(poNumber));
          showNotification("លុបបានជោគជ័យ");
          closeConfirmDialog();
        } catch (error) { showNotification("បរាជ័យ", 'error'); }
      },
      isDangerous: true
    });
  };

  const handleNewOrder = () => {
    if (!isAdmin) { showNotification("Admin Only", 'warning'); return; }
    setMobileNavOpen(false);
    setOrderInfo({
      customer: '', phone: '', date: new Date().toISOString().split('T')[0],
      deadline: '', poNumber: getNextPONumber(savedOrders), quantity: 0,
      status: 'pending_operation', startStep: 0,
      sizes: {
        male: { 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'XXXL': 0 },
        female: { 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'XXXL': 0 },
        kids_male: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0 },
        kids_female: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0 }
      }
    });
    setSpecs({ ...DEFAULT_SPECS });
    setStepsData({}); setImageCount(1); setUploadedImages([null]); setViewMode('form');
  };

  const handleImageCountChange = (count) => {
    const newCount = parseInt(count); setImageCount(newCount);
    setUploadedImages(prev => {
      const newArr = Array(newCount).fill(null);
      for (let i = 0; i < Math.min(prev.length, newCount); i++) newArr[i] = prev[i];
      return newArr;
    });
  };

  const handleImageUpload = async (e, index) => {
    const inputElement = e.target;
    const file = inputElement.files?.[0];
    if (!file) return;

    if (file.size >= MAX_UPLOAD_IMAGE_SIZE_BYTES) {
      showNotification("Upload < 5MB", 'warning');
      inputElement.value = '';
      return;
    }

    try {
      const originalImageDataURL = await readFileAsDataURL(file);
      const compressedImageDataURL = await compressImageSourceForFirestore(
        originalImageDataURL,
        DEFAULT_IMAGE_DATA_URL_TARGET_BYTES
      );

      setUploadedImages((prev) => {
        const newImages = [...prev];
        newImages[index] = compressedImageDataURL;
        return newImages;
      });
    } catch (error) {
      console.error('Image processing failed:', error);
      showNotification("Image processing failed.", 'error');
    } finally {
      inputElement.value = '';
    }
  };

  const removeImage = (index) => {
    const newImages = [...uploadedImages]; newImages[index] = null; setUploadedImages(newImages);
  }

  // --- RENDER LOGIN SCREEN ---
  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} authError={authError} />;
  }

  // --- RENDER MAIN APP ---
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 print:bg-white print:h-auto">

      {mobileNavOpen && !isGeneratingPDF && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] md:hidden print:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* --- NOTIFICATION --- */}
      {notification && (
        <div className={`fixed top-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white shadow-lg animate-bounce ${notification.type === 'error' ? 'bg-red-500' : notification.type === 'info' ? 'bg-blue-600' : 'bg-green-600'} print:hidden`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />} {notification.msg}
        </div>
      )}

      {/* --- CONFIRM DIALOG --- */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmDialog.isDangerous ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {confirmDialog.isDangerous ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{confirmDialog.title}</h3>
              <p className="text-gray-500 mb-6">{confirmDialog.message}</p>
              {Array.isArray(confirmDialog.nextRoleOptions) && confirmDialog.nextRoleOptions.length > 0 && (
                <div className="w-full text-left mb-4">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Send next task to role</label>
                  <select
                    value={confirmDialog.selectedNextRole}
                    onChange={(e) => setConfirmDialog((prev) => ({ ...prev, selectedNextRole: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {confirmDialog.nextRoleOptions.map((option) => (
                      <option key={`${option.index}-${option.role}`} value={option.role}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <button onClick={closeConfirmDialog} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">ទេ (No)</button>
                <button onClick={() => confirmDialog.onConfirm?.(confirmDialog.selectedNextRole)} className={`flex-1 px-4 py-2 text-white rounded-lg font-medium shadow-md ${confirmDialog.isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>បាទ/ចាស (Yes)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- APPROVE MODAL (OPERATION) --- */}
      {approveModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-700">
              <Send size={20} /> អនុម័ត & ផ្ញើទៅផលិត
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700">បញ្ជូនទៅផ្នែកណា? (Select Starting Step)</label>
              <select
                className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                value={approveModal.startStep}
                onChange={(e) => setApproveModal({ ...approveModal, startStep: parseInt(e.target.value) })}
              >
                {STEPS.map((step, idx) => (
                  <option key={step.id} value={idx}>{step.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                * ជំហានមុនផ្នែកដែលបានជ្រើសរើស នឹងត្រូវបានរំលង (Skipped)។
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setApproveModal({ show: false, order: null, startStep: 0 })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">បោះបង់</button>
              <button onClick={confirmApproveOrder} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-bold">បញ្ជូន (Send)</button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECEIVE MODAL --- */}
      {receiveModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2 text-blue-700">
                <Play size={20} /> ទទួលការងារ: {STEPS[receiveModal.stepIndex].label}
              </h3>
              <button onClick={() => setReceiveModal({ show: false, order: null, stepIndex: null, quantity: 0, sizes: {} })} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto flex-1 mb-4 pr-2">
              <div className="bg-blue-50 p-3 rounded-lg mb-4 border border-blue-100">
                <p className="text-sm text-blue-800">សូមផ្ទៀងផ្ទាត់ចំនួនដែលបានទទួលជាក់ស្តែង (Verify Actual Quantity)</p>
              </div>
              {['male', 'female', 'kids_male', 'kids_female'].map(category => (
                <div key={category} className="mb-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                    {category === 'male' ? 'ប្រុស (Male)' : category === 'female' ? 'ស្រី (Female)' : category === 'kids_male' ? 'ក្មេងប្រុស (Kids Male)' : 'ក្មេងស្រី (Kids Female)'}
                  </h4>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {receiveModal.sizes[category] && Object.keys(receiveModal.sizes[category]).map(size => (
                      <div key={size} className="flex flex-col">
                        <label className="text-[10px] text-center font-bold mb-1 text-gray-600">{size}</label>
                        <input type="number" value={receiveModal.sizes[category][size]} onChange={(e) => updateReceiveModalSize(category, size, e.target.value)} className={`p-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none ${receiveModal.sizes[category][size] > 0 ? 'bg-white font-bold text-black border-blue-300 shadow-sm' : 'bg-gray-50 text-gray-400'}`} min="0" onFocus={(e) => e.target.select()} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div><span className="text-gray-500 text-xs font-bold block">សរុប (Total Received):</span><span className="text-3xl font-bold text-blue-700">{receiveModal.quantity}</span></div>
              <button onClick={confirmReceive} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-bold flex items-center gap-2"><CheckCircle size={20} /> យល់ព្រម (Confirm)</button>
            </div>
          </div>
        </div>
      )}

      {/* --- QR SCANNER --- */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white p-4 rounded-lg w-full max-w-md">
            <div className="flex justify-between mb-2"><h3 className="font-bold">Scan QR Code</h3><button onClick={() => setShowScanner(false)}><X /></button></div>
            <div id="reader" className="w-full"></div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen md:h-screen">
      {/* --- SIDEBAR --- */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[82vw] max-w-xs -translate-x-full flex-col border-r border-gray-200 bg-white transition-transform duration-300 md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 ${mobileNavOpen && !isGeneratingPDF ? 'translate-x-0 shadow-2xl' : ''} ${isGeneratingPDF ? 'hidden' : 'print:hidden'}`}>
        <div className="flex items-center gap-3 border-b border-gray-100 p-4 md:p-6">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><Shirt size={24} /></div>
          <div className="min-w-0 flex-1"><h1 className="truncate font-bold text-lg text-blue-900 leading-tight">ប្រព័ន្ធផលិត</h1><p className="text-xs text-gray-500">T-Shirt Manager</p></div>
          <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 md:hidden">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setViewMode('list'); setListFilter('all'); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${viewMode === 'list' && listFilter === 'all' ? 'bg-blue-50 text-blue-700 font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}><div className="flex items-center gap-3"><Home size={20} /> <span>ទាំងអស់</span></div></button>
          {!isAdmin && <button onClick={() => { setViewMode('list'); setListFilter('my_tasks'); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${viewMode === 'list' && listFilter === 'my_tasks' ? 'bg-blue-50 text-blue-700 font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}><div className="flex items-center gap-3"><Inbox size={20} /> <span>ការងារខ្ញុំ</span></div>{pendingTasksCount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingTasksCount}</span>}</button>}
          <button onClick={() => { setViewMode('list'); setListFilter('history'); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${viewMode === 'list' && listFilter === 'history' ? 'bg-blue-50 text-blue-700 font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}><div className="flex items-center gap-3"><History size={20} /> <span>ប្រវត្តិ {isAdmin && "(ចប់រួចរាល់)"}</span></div></button>
          {isAdmin && <button onClick={handleNewOrder} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${viewMode === 'form' && !orderInfo.id ? 'bg-blue-50 text-blue-700 font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}><PlusCircle size={20} /><span>បង្កើតថ្មី</span></button>}
        </nav>
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-3"><div className="bg-blue-100 p-2 rounded-full text-blue-600"><User size={20} /></div><div><p className="text-sm font-bold text-gray-800">{currentRoleLabel}</p><p className="text-[10px] text-green-600 flex items-center gap-1">● Online</p></div></div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"><LogOut size={16} /> ចាកចេញ (Logout)</button>
        </div>
      </aside>

        <div className="flex min-h-screen flex-1 flex-col md:h-screen">
          {!isGeneratingPDF && (
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden print:hidden">
              <button onClick={() => setMobileNavOpen(true)} className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-700 shadow-sm">
                <Menu size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{mobileViewTitle}</p>
                <p className="text-[11px] text-gray-500">{currentRoleLabel}</p>
              </div>
              {!isAdmin && viewMode === 'list' && pendingTasksCount > 0 && (
                <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">{pendingTasksCount}</span>
              )}
            </header>
          )}

      {/* --- MAIN CONTENT --- */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 ${isGeneratingPDF ? 'p-0 bg-white' : 'px-4 py-4 sm:px-5 md:p-6 print:p-0 print:bg-white'}`}>
        {/* LIST VIEW */}
        {viewMode === 'list' && (
          <div className="max-w-6xl mx-auto space-y-6 print:hidden">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 md:text-2xl">{listTitle}</h2>
                <p className="mt-1 text-sm text-gray-500">{listDescription}</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input ref={searchInputRef} type="text" placeholder="ស្វែងរក / Scan QR..." className="w-full pl-10 p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer hover:text-blue-500 transition" onClick={() => setShowScanner(true)}><ScanLine size={16} /></div>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {filteredOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm italic text-gray-400">
                  មិនទាន់មាន Order
                </div>
              ) : filteredOrders.map((order) => {
                const statusMeta = getOrderStatusMeta(order);
                return (
                  <div key={order.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleLoad(order)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleLoad(order);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">PO Number</p>
                          <p className="truncate font-mono text-lg font-bold text-blue-700">{order.orderInfo.poNumber}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">Customer</p>
                          <p className="font-medium text-gray-900">{order.orderInfo.customer || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">Quantity</p>
                          <p className="font-bold text-gray-900">{order.orderInfo.quantity} pcs</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">Deadline</p>
                          <p className="font-medium text-gray-900">{order.orderInfo.deadline || '-'}</p>
                        </div>
                      </div>
                      <div className="mt-4 text-xs font-medium text-blue-600">ចុចដើម្បីបើកព័ត៌មានលម្អិត</div>
                    </div>
                    {isAdmin && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <button onClick={(e) => handleDelete(order.id, e)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100">
                          <Trash2 size={16} />
                          លុប Order
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-200">
                    <tr><th className="p-4">PO Number</th><th className="p-4">អតិថិជន</th><th className="p-4">ចំនួន</th><th className="p-4">ថ្ងៃកំណត់</th><th className="p-4">ស្ថានភាព</th><th className="p-4 text-right">សកម្មភាព</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredOrders.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-400 italic">គ្មានទិន្នន័យ</td></tr> : filteredOrders.map(order => {
                      let displayStatus = null;
                      let actionButton = null;
                      const sData = order.stepsData || {};
                      const orderStatus = order.orderInfo.status || 'pending_operation';
                      const startStep = order.orderInfo.startStep || 0;

                      if (orderStatus === 'pending_operation') {
                        if (isOperation) {
                          displayStatus = <span className="text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded text-xs">រង់ចាំការអនុម័ត</span>;
                          actionButton = <button onClick={(e) => { e.stopPropagation(); openApproveModal(order) }} className="bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 text-xs font-bold shadow-sm flex items-center gap-1"><Send size={12} /> ផ្ញើទៅផលិត</button>;
                        } else { displayStatus = <span className="text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded text-xs flex items-center gap-1"><Lock size={12} /> រង់ចាំ Operation</span>; }
                      } else {
                        if (listFilter === 'my_tasks' && !isAdmin && !isOperation) {
                          const activeStepIndex = STEPS.findIndex((step, idx) => {
                            const isMyRole = currentRole.permissions.includes(idx);
                            const stepStatus = sData[idx]?.status || 'pending';
                            const ready = isStepReady(idx, sData, startStep);
                            return isMyRole && ((stepStatus === 'pending' && ready) || stepStatus === 'in_progress');
                          });
                          if (activeStepIndex !== -1) {
                            const currentStatus = sData[activeStepIndex]?.status || 'pending';
                            if (currentStatus === 'pending') {
                              displayStatus = <span className="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded text-xs flex items-center gap-1"><Play size={12} /> រង់ចាំអ្នកទទួល</span>;
                              actionButton = <button onClick={(e) => { e.stopPropagation(); openReceiveModal(order, activeStepIndex) }} className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 text-xs font-bold shadow-sm">ទទួល (Receive)</button>;
                            } else if (currentStatus === 'in_progress') {
                              displayStatus = <span className="text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded text-xs flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> កំពុងធ្វើ...</span>;
                              actionButton = <button onClick={(e) => { e.stopPropagation(); openConfirmComplete(order, activeStepIndex) }} className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 text-xs font-bold shadow-sm">បញ្ចប់ (Finish)</button>;
                            }
                          }
                        }
                        if (!displayStatus) {
                          let lastStepIndex = -1;
                          Object.keys(sData).forEach(k => { if (parseInt(k) > lastStepIndex) lastStepIndex = parseInt(k); });
                          if (lastStepIndex > -1) {
                            displayStatus = <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sData[lastStepIndex].status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{STEPS[lastStepIndex]?.label}</span>;
                          } else { displayStatus = <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">កំពុងផលិត</span>; }
                        }
                      }
                      return (
                        <tr key={order.id} className="hover:bg-blue-50 transition cursor-pointer group" onClick={() => handleLoad(order)}>
                          <td className="p-4 font-mono font-bold text-blue-600">{order.orderInfo.poNumber}</td>
                          <td className="p-4 font-medium text-gray-900">{order.orderInfo.customer}</td>
                          <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold">{order.orderInfo.quantity}</span></td>
                          <td className="p-4 text-gray-500">{order.orderInfo.deadline}</td>
                          <td className="p-4">{displayStatus}</td>
                          <td className="p-4 text-right">
                            {actionButton ? (
                              <>{actionButton}</> // ធានាថាវាជា React Element ត្រឹមត្រូវ
                            ) : (
                              isAdmin && (<button onClick={(e) => handleDelete(order.id, e)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>)
                            )}
                          </td>
                        </tr>
                      )
                    })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FORM VIEW */}
        {viewMode === 'form' && (
          <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
            {/* Action Bar */}
            <div className={`mb-6 flex flex-col gap-3 ${isGeneratingPDF ? 'hidden' : 'print:hidden'} sm:flex-row sm:items-start sm:justify-between`}>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-200 rounded-full transition"><ArrowLeft size={20} /></button>
                <h2 className="text-lg font-bold text-gray-800 sm:text-2xl">{orderInfo.poNumber ? `Order: ${orderInfo.poNumber}` : 'ការកុម្ម៉ង់ថ្មី'}</h2>
                {orderInfo.status === 'pending_operation' && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs sm:text-sm font-bold flex items-center gap-1"><Lock size={12} /> Pending Operation</span>}
                {orderInfo.status === 'production' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs sm:text-sm font-bold flex items-center gap-1"><RefreshCw size={12} /> In Production</span>}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {isOperation && orderInfo.status === 'pending_operation' && (<button onClick={() => openApproveModal({ orderInfo, stepsData })} className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white shadow-sm transition hover:bg-purple-700 sm:w-auto"><Send size={18} /> Approve & Send</button>)}
                {isAdmin && <button onClick={handleSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white shadow-sm transition hover:bg-green-700 sm:w-auto"><Save size={18} /> Save</button>}
                <button onClick={handleDownloadPDF} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"><FileDown size={18} /> PDF</button>
              </div>
            </div>

            {/* Loading Overlay */}
            {isGeneratingPDF && (
              <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center"><FileDown size={48} className="text-blue-600 animate-bounce mb-4" /><p className="text-xl font-bold text-gray-700">កំពុងបង្កើត PDF...</p></div>
            )}

            {/* PRINTABLE CONTENT */}
            <div ref={contentRef} id="printable-area" className={`${isGeneratingPDF ? 'p-8 bg-white' : ''}`}>
              <div className={`${isGeneratingPDF ? 'flex' : 'hidden print:flex'} justify-between items-start mb-8 border-b-2 border-gray-700 pb-5`}>
                <div>
                  <h1 className="text-[34px] leading-tight font-extrabold text-gray-800 mb-4 tracking-tight">PRODUCTION TICKET</h1>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[15px]">
                    <div><span className="text-gray-500 font-semibold">លេខទូរស័ព្ទ:</span> <span className="ml-2 font-semibold">{orderInfo.phone || '-'}</span></div>
                    <div className="col-span-2 mt-2"><span className="text-red-500 font-bold">ថ្ងៃកំណត់:</span> <span className="ml-2 font-bold text-red-600 border border-red-200 bg-red-50 px-2 rounded">{orderInfo.deadline || '-'}</span></div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center bg-white p-2 border border-gray-300 rounded-lg">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(orderInfo.poNumber)}`} alt="PO QR Code" className="w-24 h-24 mb-1" crossOrigin="anonymous" />
                  <span className="text-[10px] font-mono text-gray-400">{orderInfo.poNumber}</span>
                </div>
              </div>

              <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isGeneratingPDF ? 'grid-cols-3 gap-6' : 'print:grid-cols-3 print:gap-6'}`}>
                <div className={`lg:col-span-1 space-y-6 ${isGeneratingPDF ? 'col-span-1' : 'print:col-span-1'}`}>
                  {!isGeneratingPDF && (
                    <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm print:hidden sm:p-5">
                      <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b"><User size={18} /> ព័ត៌មានអតិថិជន</h2>
                      <div className="space-y-3">
                        <input disabled={!isAdmin} type="text" value={orderInfo.customer} onChange={(e) => setOrderInfo({ ...orderInfo, customer: e.target.value })} className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${!isAdmin ? 'bg-gray-100 text-gray-500 border-gray-200' : 'border-gray-300'}`} placeholder="ឈ្មោះ..." />
                        <input disabled={!isAdmin} type="text" value={orderInfo.phone} onChange={(e) => setOrderInfo({ ...orderInfo, phone: e.target.value })} className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${!isAdmin ? 'bg-gray-100 text-gray-500 border-gray-200' : 'border-gray-300'}`} placeholder="លេខទូរស័ព្ទ..." />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input disabled={!isAdmin} type="date" value={orderInfo.date} onChange={(e) => setOrderInfo({ ...orderInfo, date: e.target.value })} className={`w-full p-2.5 border rounded-lg outline-none ${!isAdmin ? 'bg-gray-100 text-gray-500 border-gray-200' : 'border-gray-300'}`} />
                          <input disabled={!isAdmin} type="date" value={orderInfo.deadline} onChange={(e) => setOrderInfo({ ...orderInfo, deadline: e.target.value })} className={`w-full p-2.5 border rounded-lg outline-none font-medium ${!isAdmin ? 'bg-gray-100 text-gray-500 border-gray-200' : 'border-red-200 bg-red-50 text-red-600'}`} />
                        </div>
                      </div>
                    </section>
                  )}
                  <section className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm sm:p-5 ${isGeneratingPDF ? 'break-inside-avoid p-0 border-0 shadow-none' : 'print:break-inside-avoid print:p-0 print:border-0 print:shadow-none'}`}>
                    <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b"><Shirt size={18} /> លក្ខណៈបច្ចេកទេស</h2>
                    <div className="space-y-4 text-sm">
                      <div className="pt-2">
                        <span className="block text-xs text-gray-400 mb-1">ការពិពណ៌នាបន្ថែម៖</span>
                        {isGeneratingPDF ? (
                          <div className="p-2 border rounded text-sm min-h-[60px] whitespace-pre-wrap font-medium">{specs.description}</div>
                        ) : (
                          <textarea disabled={!isAdmin} className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${!isAdmin ? 'bg-gray-100' : ''}`} rows="5" placeholder="សរសេរលម្អិតពីអាវ (ម៉ូត, ពណ៌, របៀបដេរ...)" value={specs.description} onChange={(e) => setSpecs({ ...specs, description: e.target.value })} />
                        )}
                        <div className="hidden print:block p-2 border rounded text-sm min-h-[60px] whitespace-pre-wrap font-medium">{specs.description}</div>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-400 mb-1">កំណត់ចំណាំបន្ថែម</span>
                        {isGeneratingPDF ? (
                          <div className="p-2 border rounded text-sm min-h-[60px] whitespace-pre-wrap font-medium">{specs.technicalNotes}</div>
                        ) : (
                          <textarea disabled={!isAdmin} className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${!isAdmin ? 'bg-gray-100' : ''}`} rows="4" placeholder="សរសេរព័ត៌មានបន្ថែមសម្រាប់ផ្នែកផលិត..." value={specs.technicalNotes} onChange={(e) => setSpecs({ ...specs, technicalNotes: e.target.value })} />
                        )}
                        <div className="hidden print:block p-2 border rounded text-sm min-h-[60px] whitespace-pre-wrap font-medium">{specs.technicalNotes}</div>
                      </div>
                    </div>
                  </section>
                  <section className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm sm:p-5 ${isGeneratingPDF ? 'p-0 border-0 shadow-none mt-4' : 'print:p-0 print:border-0 print:shadow-none print:mt-4'}`}>
                    <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b"><LayoutList size={18} /> ចំនួន & ទំហំ</h2>
                    {['male', 'female', 'kids_male', 'kids_female'].map(category => (
                      <div key={category} className="mb-3">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{category.replace('_', ' ')}</h4>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {Object.keys(orderInfo.sizes[category]).map(size => (
                            <div key={size} className="flex flex-col">
                              <label className="text-[10px] text-center font-bold mb-1 text-gray-400">{size}</label>
                              <input disabled={!isAdmin} type="number" value={orderInfo.sizes[category][size]} onChange={(e) => setOrderInfo(prev => ({ ...prev, sizes: { ...prev.sizes, [category]: { ...prev.sizes[category], [size]: parseInt(e.target.value) || 0 } } }))} className={`p-1 border rounded text-center text-sm outline-none ${isGeneratingPDF ? 'border-0 font-bold' : ''} ${orderInfo.sizes[category][size] > 0 ? 'bg-blue-50 font-bold text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400'} ${!isAdmin ? 'bg-gray-50' : ''}`} min="0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className={`flex justify-between items-center p-3 rounded-lg bg-gray-50 mt-4 ${isGeneratingPDF ? 'bg-white border-t-2 border-black rounded-none p-2' : 'print:bg-white print:border-t-2 print:border-black print:p-2'}`}><span className="font-bold text-gray-700">សរុប៖</span><span className="text-xl font-bold text-blue-700 print:text-black">{orderInfo.quantity} pcs</span></div>
                  </section>
                </div>

                {/* RIGHT COLUMN */}
                <div className={`lg:col-span-2 space-y-6 ${isGeneratingPDF ? 'col-span-2' : 'print:col-span-2'}`}>
                  <section className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm sm:p-6 ${isGeneratingPDF ? 'shadow-none border-0 p-0' : 'print:shadow-none print:border-0 print:p-0'}`}>
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="font-semibold text-gray-700 flex items-center gap-2"><ImageIcon size={18} /> គំរូអាវ</h2>
                      <div className="flex items-center justify-between gap-2 print:hidden sm:justify-start">
                        <span className="text-sm font-medium text-gray-600">ចំនួនរូបភាព:</span>
                        <select className="border rounded p-1 text-sm outline-none" value={imageCount} onChange={(e) => handleImageCountChange(e.target.value)} disabled={!isAdmin}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select>
                      </div>
                    </div>
                    <div className={`grid gap-4 ${imageCount > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} ${isGeneratingPDF ? '' : 'print:grid'}`}>
                      {uploadedImages.map((img, idx) => (
                        <div key={idx} className={`relative flex h-56 flex-col items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 sm:h-64 ${isGeneratingPDF ? 'border-0 bg-transparent' : 'print:border-0 print:bg-transparent'}`}>
                          {img ? (
                            <>
                              <div className="relative w-full h-full flex items-center justify-center"><img src={img} className="max-h-full max-w-full object-contain p-2" crossOrigin="anonymous" />{!isGeneratingPDF && isAdmin && (<button onClick={() => removeImage(idx)} className="absolute top-2 right-2 p-1 bg-white rounded-full shadow text-red-500 hover:text-red-700 print:hidden"><X size={16} /></button>)}</div>
                            </>
                          ) : (
                            <>
                              <TShirtMockup uploadedImage={null} color={specs.colorValue} />
                              {!isGeneratingPDF && isAdmin && (
                                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/5 text-gray-500 opacity-100 transition hover:text-blue-500 md:opacity-0 md:hover:opacity-100"><Upload size={32} className="mb-2" /><span className="text-xs font-medium">Upload Image {idx + 1}</span><input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, idx)} /></label>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Detail Inputs below image */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1">អាវម៉ូត (ត្បាញកអាវ/ចុងដៃ)</label>
                        <select
                          disabled={!isAdmin}
                          value={specs.styleOption}
                          onChange={(e) => setSpecs({ ...specs, styleOption: e.target.value })}
                          className={`w-full p-2 border rounded-lg text-sm font-medium outline-none ${!isAdmin ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
                        >
                          {STYLE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Front Logo Size</label>
                        <input
                          type="text"
                          disabled={!isAdmin}
                          className={`w-full p-2 border rounded-lg text-sm outline-none ${!isAdmin ? 'bg-gray-100' : ''}`}
                          value={specs.logoFrontSize}
                          onChange={(e) => setSpecs({ ...specs, logoFrontSize: e.target.value })}
                          placeholder="Ex: 10cm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Back Logo Size</label>
                        <input
                          type="text"
                          disabled={!isAdmin}
                          className={`w-full p-2 border rounded-lg text-sm outline-none ${!isAdmin ? 'bg-gray-100' : ''}`}
                          value={specs.logoBackSize}
                          onChange={(e) => setSpecs({ ...specs, logoBackSize: e.target.value })}
                          placeholder="Ex: A4"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Logo Color</label>
                        <input
                          type="text"
                          disabled={!isAdmin}
                          className={`w-full p-2 border rounded-lg text-sm outline-none ${!isAdmin ? 'bg-gray-100' : ''}`}
                          value={specs.logoColor}
                          onChange={(e) => setSpecs({ ...specs, logoColor: e.target.value })}
                          placeholder="Ex: White / Red"
                        />
                      </div>
                    </div>
                  </section>

                  {!isGeneratingPDF && (
                    <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm print:border-black print:mt-6 sm:p-6">
                      <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b"><Clock size={18} /> តាមដានស្ថានភាព (Status)</h2>
                      <div className={`space-y-3 ${orderInfo.status === 'pending_operation' ? 'opacity-50 pointer-events-none' : ''}`}>
                        {STEPS.map((step, index) => {
                          const stepInfo = stepsData[index] || { status: 'pending', quantity: 0 };
                          const status = stepInfo.status;
                          const canClick = hasPermission(index);
                          const roleName = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === step.role)]?.label;
                          const isPrevCompleted = index === 0 || (stepsData[index - 1] && stepsData[index - 1].status === 'completed');
                          // Bypass sequential check if startStep is set and index matches or follows
                          const ready = isStepReady(index, stepsData, orderInfo.startStep || 0);

                          return (
                            <div key={step.id} className={`flex flex-col items-start gap-3 rounded-lg border p-3 transition-all sm:flex-row sm:items-center sm:gap-4 ${status === 'in_progress' ? 'bg-blue-50 border-blue-200 shadow-sm' : status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'} print:border-gray-300 print:p-1`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm ${status === 'completed' ? 'bg-green-500' : status === 'in_progress' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}>
                                {status === 'completed' ? <CheckSquare size={16} /> : <span className="font-bold text-xs">{index + 1}</span>}
                              </div>
                              <div className="flex-1 self-stretch">
                                <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className={`font-bold text-sm ${status === 'completed' ? 'text-green-800' : 'text-gray-700'}`}>{step.label}</span>
                                  <span className="self-start rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400 print:hidden">{roleName}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    {status === 'pending' && (
                                      canClick && ready ?
                                        <button onClick={() => openReceiveModal({ orderInfo, stepsData }, index)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1 shadow-sm transition"><Play size={10} /> ទទួលការងារ</button> :
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                          {!canClick && !status && !isAdmin && !isOperation && <Lock size={12} />}
                                          {isAdmin || isOperation ? 'រង់ចាំ' : (canClick ? 'រង់ចាំជំហានមុន' : 'គ្មានសិទ្ធិ')}
                                        </span>
                                    )}
                                    {status === 'in_progress' && (
                                      <div className="flex items-center gap-3 w-full justify-between"><span className="text-xs font-bold text-blue-700">កំពុងធ្វើ... ({stepInfo.quantity} pcs)</span>{canClick && <button onClick={() => openConfirmComplete({ orderInfo, stepsData }, index)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 flex items-center gap-1 shadow-sm transition"><CheckCircle size={10} /> បញ្ចប់</button>}</div>
                                    )}
                                    {status === 'completed' && <span className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={12} /> រួចរាល់ ({stepInfo.quantity} pcs)</span>}
                                  </div>
                                  {(stepInfo.receivedAt || stepInfo.completedAt) && (<div className="text-[10px] text-gray-500 mt-1 pl-1 border-l-2 border-gray-200">{stepInfo.receivedAt && <div>• ទទួល: {formatDate(stepInfo.receivedAt)} {stepInfo.receivedBy ? `ដោយ ${stepInfo.receivedBy}` : ''}</div>}{stepInfo.completedAt && <div>• បញ្ចប់: {formatDate(stepInfo.completedAt)}</div>}</div>)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  <div className={`${isGeneratingPDF ? 'flex' : 'hidden print:flex'} justify-between mt-12 pt-8 border-t-2 border-gray-300 break-inside-avoid`}><div className="text-center w-1/3"><p className="mb-12 font-bold text-gray-800">អ្នករៀបចំ</p><div className="border-t border-black w-2/3 mx-auto"></div></div><div className="text-center w-1/3"><p className="mb-12 font-bold text-gray-800">QC / អ្នកត្រួតពិនិត្យ</p><div className="border-t border-black w-2/3 mx-auto"></div></div><div className="text-center w-1/3"><p className="mb-12 font-bold text-gray-800">អតិថិជន</p><div className="border-t border-black w-2/3 mx-auto"></div></div></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
        </div>
      </div>
    </div>
  );
}








