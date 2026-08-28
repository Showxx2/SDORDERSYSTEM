import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, User, Search, Send, X, Plus, Trash2, Lock, Info, 
  History, Sparkles, TrendingUp, Layers, Package, Shield, 
  SendHorizontal, Truck, LogOut, 
  FileText, ChevronLeft, Percent, CreditCard, Wallet, 
  ShoppingCart, ShoppingBag, AlertTriangle, Banknote, Gift, Clock, Scissors,
  Eye, EyeOff, SlidersHorizontal, Activity, Check, ChevronDown, Phone,
  Flame, Coffee, Bell, ChefHat, Utensils, CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell 
} from 'recharts';

// TypeScript Interfaces
interface UserItem {
  id: number;
  username: string;
  password?: string;
  role: 'admin' | 'staff';
  name: string;
  phone_number?: string;
  web_roles?: string[]; // Pl. ['Futár', 'Szakács', 'Diszpécser', 'Felszolgáló']
  color?: string; // hex
  symbol?: string; // Lucide icon name (pl. 'Truck', 'ChefHat', 'Send', 'User')
  is_banned?: boolean;
}

interface Shift {
  id: string;
  userId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  roles: string[]; // ['Szakács', 'Futár', etc.]
}

interface WebSession {
  userId: number;
  loginTime: string;
  activeView: 'kitchen' | 'courier' | 'landing';
}

interface PromotionSettings {
  isEnabled: boolean;
  type: 'once' | 'recurring';
  onceDate?: string; // YYYY-MM-DD
  recurringDays?: number[]; // 1 = Mon, 7 = Sun
  recurringWeeksInterval?: number; // 1 = every week, 2 = every 2 weeks, etc.
  recurringStartDate?: string; // YYYY-MM-DD
  priceAdjustmentType: 'percent' | 'fixed';
  priceAdjustmentValue: number; // e.g. -10 or +15 or 1500
  packagingFeePolicy: 'standard' | 'free' | 'discounted';
}

interface CourseDefinition {
  id: number;
  name: string; // e.g. "Első fogás"
  sourceType: 'category' | 'individual';
  sourceCategoryId?: number | null;
  itemIds?: number[];
  itemOverrides?: {
    [itemId: number]: {
      price: number;
      ingredients: {
        ingredientId: number;
        quantity: number;
      }[];
    }
  };
}

interface MenuSchedule {
  days?: number[]; // 1 = Monday, 7 = Sunday
  fromTime?: string; // "HH:MM"
  toTime?: string; // "HH:MM"
}

interface Category {
  id: number;
  name: string;
  description?: string;
  is_active?: boolean;
  linked_category_id?: number | null;
  include_linked_packaging_fee?: boolean;
  promotion?: PromotionSettings;
  is_menu_category?: boolean;
  courses?: CourseDefinition[];
  menu_schedule?: MenuSchedule;
}

interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  price: number;
  packaging_fee: number;
  packaging_type?: string;
  description?: string;
  ingredients?: { ingredientId: number; quantity: number }[];
  allergens?: string[];
  is_active?: boolean;
  promotion?: PromotionSettings;
}

interface MenuCourseChoice {
  courseId: number;
  courseName: string;
  itemId: number | null; // null if skipped
  itemName: string;
  price: number;
  packagingFee: number;
  ingredients: { ingredientId: number; quantity: number }[];
}

interface OrderItem {
  item_id: number;
  name: string;
  quantity: number;
  price_at_order: number;
  packaging_fee_at_order: number;
  custom_modifications?: {
    portion: 'full' | 'half';
    ingredient_adjustments: { [ingredientId: number]: 'none' | 'normal' | 'double' };
    note: string;
    extra_price: number;
    calculated_price: number;
    linked_item?: {
      item_id: number;
      name: string;
      price_at_order: number;
    } | null;
    is_menu_order?: boolean;
    selected_courses?: MenuCourseChoice[];
  };
}

interface Order {
  id: number;
  customer_id?: string | null;
  customer_name: string;
  customer_address: string;
  payment_method: string;
  discount_percentage: number;
  total_amount: number;
  status: 'pending' | 'completed';
  created_at: string;
  items: OrderItem[];
  split_details?: any;
  created_by_user?: string;
  archived?: boolean;
  delivery_fee?: number;
  
  // Kitchen and Courier Portal Fields
  preparation_status?: 'preparing' | 'ready_for_delivery' | 'delivered';
  assigned_courier_id?: number | null;
  cook_timer_minutes?: number;
  cook_timer_started_at?: string; // ISO string
}

interface Customer {
  id: string;
  name: string;
  phone_prefix: string;
  phone_number: string;
  zip: string;
  city: string;
  street: string;
  house_number: string;
  details: string;
  points: number;
  is_problematic: boolean;
}

const ZALA_ZIP_MAP: { [key: string]: string } = {
  '8900': 'Zalaegerszeg',
  '8800': 'Nagykanizsa',
  '8360': 'Keszthely',
  '8960': 'Lenti',
  '8790': 'Zalaszentgrót',
  '8868': 'Letenye',
  '8749': 'Zalakaros',
  '8756': 'Zalakomár',
  '8991': 'Teskánd'
};

const renderUserIcon = (symbol: string, size = 16, color = 'white') => {
  switch (symbol) {
    case 'ChefHat':
      return <ChefHat size={size} style={{ color }} />;
    case 'Truck':
      return <Truck size={size} style={{ color }} />;
    case 'Flame':
      return <Flame size={size} style={{ color }} />;
    case 'Coffee':
      return <Coffee size={size} style={{ color }} />;
    case 'Bell':
      return <Bell size={size} style={{ color }} />;
    case 'Utensils':
      return <Utensils size={size} style={{ color }} />;
    case 'Shield':
      return <Shield size={size} style={{ color }} />;
    case 'User':
    default:
      return <User size={size} style={{ color }} />;
  }
};

const renderKitchenItemModifications = (item: OrderItem, inventory: any[]) => {
  if (!item.custom_modifications) return null;

  if (item.custom_modifications.is_menu_order) {
    const selectedCourses = item.custom_modifications.selected_courses || [];
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginTop: '6px',
        padding: '6px 10px',
        textAlign: 'left',
        background: 'rgba(10, 132, 255, 0.05)',
        border: '1px solid rgba(10, 132, 255, 0.15)',
        borderRadius: '8px'
      }}>
        {selectedCourses.map((choice, idx) => (
          <div key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--primary)' }}>{choice.courseName}:</strong> {choice.itemName}
          </div>
        ))}
      </div>
    );
  }

  const { portion, ingredient_adjustments, note, linked_item } = item.custom_modifications;

  const doubleIngs: string[] = [];
  const removedIngs: string[] = [];
  Object.keys(ingredient_adjustments || {}).forEach(key => {
    const ingId = Number(key);
    const adj = ingredient_adjustments[ingId];
    if (adj === 'double' || adj === 'none') {
      const invItem = inventory.find((inv: any) => inv.id === ingId);
      if (invItem) {
        if (adj === 'double') doubleIngs.push(invItem.name);
        if (adj === 'none') removedIngs.push(invItem.name);
      }
    }
  });

  if (portion !== 'half' && doubleIngs.length === 0 && removedIngs.length === 0 && !note && !linked_item) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      marginTop: '6px',
      padding: '4px 0',
      textAlign: 'left'
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {portion === 'half' && (
          <span style={{
            background: 'rgba(255, 159, 10, 0.15)',
            border: '1px solid #ff9f0a',
            color: '#ff9f0a',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            🔸 FÉL ADAG (70%)
          </span>
        )}

        {linked_item && (
          <span style={{
            background: 'rgba(10, 132, 255, 0.15)',
            border: '1px solid #0a84ff',
            color: '#0a84ff',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            ➕ CSATOLMÁNY: {linked_item.name}
          </span>
        )}

        {doubleIngs.map((name, idx) => (
          <span key={`double-${idx}`} style={{
            background: 'rgba(48, 209, 88, 0.15)',
            border: '1px solid #30d158',
            color: '#30d158',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            ➕ DUPLA: {name}
          </span>
        ))}

        {removedIngs.map((name, idx) => (
          <span key={`removed-${idx}`} style={{
            background: 'rgba(255, 69, 58, 0.15)',
            border: '1px solid #ff453a',
            color: '#ff453a',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            textDecoration: 'line-through',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            ❌ NÉLKÜL: {name}
          </span>
        ))}
      </div>

      {note && (
        <div style={{
          background: 'rgba(100, 210, 255, 0.12)',
          border: '1px solid #64d2ff',
          color: '#64d2ff',
          padding: '6px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: 600,
          width: '100%',
          marginTop: '4px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          wordBreak: 'break-word',
          boxShadow: '0 2px 6px rgba(100, 210, 255, 0.05)'
        }}>
          <span style={{ fontSize: '12px' }}>💬</span>
          <span style={{ flex: 1 }}>Megjegyzés: <strong>"{note}"</strong></span>
        </div>
      )}
    </div>
  );
};

const getPaymentMethodIcon = (method: string, size = 14) => {
  switch (method) {
    case 'Készpénz':
      return <Banknote size={size} />;
    case 'Bankkártya':
      return <CreditCard size={size} />;
    case 'SZÉP Kártya':
      return <Wallet size={size} />;
    case 'Ajándékutalvány':
      return <Gift size={size} />;
    case 'Számla':
      return <FileText size={size} />;
    case 'Később fizet':
      return <Clock size={size} />;
    case 'Bontott fizetés':
      return <Scissors size={size} />;
    default:
      return <CreditCard size={size} />;
  }
};

const getPaymentMethodStyle = (method: string) => {
  switch (method) {
    case 'Készpénz':
      return { backgroundColor: 'rgba(48, 209, 88, 0.15)', border: '1px solid rgba(48, 209, 88, 0.3)', color: '#30d158' };
    case 'Bankkártya':
      return { backgroundColor: 'rgba(10, 132, 255, 0.15)', border: '1px solid rgba(10, 132, 255, 0.3)', color: '#0a84ff' };
    case 'SZÉP Kártya':
      return { backgroundColor: 'rgba(255, 159, 10, 0.15)', border: '1px solid rgba(255, 159, 10, 0.3)', color: '#ff9f0a' };
    case 'Ajándékutalvány':
      return { backgroundColor: 'rgba(191, 90, 242, 0.15)', border: '1px solid rgba(191, 90, 242, 0.3)', color: '#bf5af2' };
    case 'Számla':
      return { backgroundColor: 'rgba(100, 210, 255, 0.15)', border: '1px solid rgba(100, 210, 255, 0.3)', color: '#64d2ff' };
    case 'Később fizet':
      return { backgroundColor: 'rgba(255, 69, 58, 0.15)', border: '1px solid rgba(255, 69, 58, 0.3)', color: '#ff453a' };
    case 'Bontott fizetés':
      return { backgroundColor: 'rgba(255, 55, 95, 0.15)', border: '1px solid rgba(255, 55, 95, 0.3)', color: '#ff375f' };
    default:
      return { backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' };
  }
};

const ALLERGEN_RULES = [
  { name: 'Glutén (1)', keywords: ['liszt', 'tészta', 'búza', 'dara', 'kenyér', 'zsemle', 'morzsa', 'glutén'], code: '1' },
  { name: 'Rákfélék (2)', keywords: ['rák', 'homár', 'garnéla'], code: '2' },
  { name: 'Tojás (3)', keywords: ['tojás', 'tojássárgája', 'tojásfehérje'], code: '3' },
  { name: 'Hal (4)', keywords: ['hal', 'tonhal', 'lazac', 'hekk', 'fogas', 'harcsa'], code: '4' },
  { name: 'Földimogyoró (5)', keywords: ['mogyoró', 'földimogyoró'], code: '5' },
  { name: 'Szójabab (6)', keywords: ['szója', 'szójabab', 'tofu'], code: '6' },
  { name: 'Tej / Laktóz (7)', keywords: ['sajt', 'tej', 'tejföl', 'vaj', 'mozzarella', 'tejszín', 'joghurt', 'trappista', 'parmezán'], code: '7' },
  { name: 'Diófélék (8)', keywords: ['dió', 'mandula', 'mogyoró', 'kesudió', 'pisztácia', 'gesztenye'], code: '8' },
  { name: 'Zeller (9)', keywords: ['zeller'], code: '9' },
  { name: 'Mustár (10)', keywords: ['mustár'], code: '10' },
  { name: 'Szezámmag (11)', keywords: ['szezám', 'szezámmag'], code: '11' },
  { name: 'Kén-dioxid / Szulfitok (12)', keywords: ['szulfit', 'kén-dioxid', 'bor', 'mazsola'], code: '12' },
  { name: 'Csillagfürt (13)', keywords: ['csillagfürt', 'lupin'], code: '13' },
  { name: 'Puhatestűek (14)', keywords: ['kagyló', 'polip', 'tintahal', 'csiga'], code: '14' }
];

const detectAllergens = (ingredientName: string): { name: string; code: string }[] => {
  const matched: { name: string; code: string }[] = [];
  const lowerName = ingredientName.toLowerCase();
  ALLERGEN_RULES.forEach(rule => {
    const hasKeyword = rule.keywords.some(kw => lowerName.includes(kw));
    if (hasKeyword) {
      matched.push({ name: rule.name, code: rule.code });
    }
  });
  return matched;
};

const getDishStockStatus = (menuItem: any, inventory: any[], ingredientsOverride?: any[]) => {
  const ingredients = ingredientsOverride || menuItem.ingredients;
  if (!ingredients || ingredients.length === 0) {
    return { status: 'ok', oosIngredient: null };
  }

  let hasWarning = false;
  let hasOutOfStock = false;
  let oosName = null;

  for (const ing of ingredients) {
    const invItem = (inventory || []).find((inv: any) => inv.id === ing.ingredientId);
    if (invItem) {
      if (invItem.quantity <= 0 || invItem.quantity < ing.quantity) {
        hasOutOfStock = true;
        oosName = invItem.name;
        break;
      }
      if (invItem.quantity <= (invItem.warning_limit || 0)) {
        hasWarning = true;
      }
    }
  }

  if (hasOutOfStock) return { status: 'out_of_stock', oosIngredient: oosName };
  if (hasWarning) return { status: 'warning', oosIngredient: null };
  return { status: 'ok', oosIngredient: null };
};

interface ChatMessage {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

function AppleSelect<T extends string | number>({
  value,
  onChange,
  options,
  icon,
  isOpen,
  onToggle,
  onClose,
  openUpward = false
}: {
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string }[];
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  openUpward?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="apple-filter-wrapper" ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        className="apple-filter-select-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          background: 'rgba(0, 0, 0, 0.25)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          color: 'white',
          padding: '8px 12px 8px 30px',
          fontSize: '12px',
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
          position: 'relative',
          transition: 'all 0.25s ease',
          boxShadow: isOpen ? '0 0 8px rgba(0, 113, 227, 0.3)' : 'none'
        }}
      >
        <span className="apple-filter-icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : String(value)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.45)' }}>
          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...(openUpward ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            left: 0,
            right: 0,
            background: '#1c1c1e',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            zIndex: 999,
            maxHeight: '220px',
            overflowY: 'auto',
            backdropFilter: 'blur(20px)',
            padding: '4px'
          }}
        >
          {options.map((opt, i) => {
            const isSel = opt.value === value;
            return (
              <div
                key={i}
                onClick={() => {
                  onChange(opt.value);
                  onClose();
                }}
                className="apple-select-option"
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: isSel ? 'white' : 'rgba(255,255,255,0.8)',
                  background: isSel ? 'var(--primary)' : 'transparent',
                  fontWeight: isSel ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.15s ease'
                }}
              >
                <span>{opt.label}</span>
                {isSel && <Check size={12} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isCategoryVisible(category: Category, date: Date = new Date()): boolean {
  if (category.is_active === false) return false;
  if (!category.is_menu_category) return true;
  if (!category.menu_schedule) return true;

  const schedule = category.menu_schedule;
  
  if (schedule.days && schedule.days.length > 0) {
    const day = date.getDay() === 0 ? 7 : date.getDay();
    if (!schedule.days.includes(day)) return false;
  }

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  
  const parseTimeToMinutes = (timeStr?: string) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return null;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };

  const fromMin = parseTimeToMinutes(schedule.fromTime);
  const toMin = parseTimeToMinutes(schedule.toTime);

  if (fromMin !== null && currentMinutes < fromMin) return false;
  if (toMin !== null && currentMinutes > toMin) return false;

  return true;
}

function isPromotionActive(promo: PromotionSettings | undefined, date: Date): boolean {
  if (!promo || !promo.isEnabled) return false;

  const ymd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (promo.type === 'once') {
    return promo.onceDate === ymd(date);
  }

  if (promo.type === 'recurring') {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    if (!promo.recurringDays || !promo.recurringDays.includes(dayOfWeek)) return false;

    if (promo.recurringWeeksInterval && promo.recurringWeeksInterval > 1) {
      const startStr = promo.recurringStartDate || ymd(new Date());
      const start = new Date(startStr);
      
      const getStartOfWeek = (d: Date) => {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0,0,0,0);
        return monday;
      };

      const startWeek = getStartOfWeek(start);
      const checkWeek = getStartOfWeek(date);

      const msDiff = checkWeek.getTime() - startWeek.getTime();
      const weeksDiff = Math.round(msDiff / (7 * 24 * 60 * 60 * 1000));

      if (weeksDiff < 0 || weeksDiff % promo.recurringWeeksInterval !== 0) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function getItemCurrentPricing(item: MenuItem, categories: Category[], date: Date = new Date()) {
  const category = categories.find((c: any) => c.id === item.category_id);
  
  const itemPromoActive = isPromotionActive(item.promotion, date);
  const catPromoActive = category ? isPromotionActive(category.promotion, date) : false;

  let activePromo: PromotionSettings | undefined = undefined;
  let activePromoLabel = '';
  let isOverride = false;

  if (itemPromoActive) {
    activePromo = item.promotion;
    activePromoLabel = 'Egyedi étel akció';
    if (catPromoActive) {
      isOverride = true;
    }
  } else if (catPromoActive && category) {
    activePromo = category.promotion;
    activePromoLabel = `Kategória akció (${category.name})`;
  }

  if (!activePromo) {
    return {
      price: item.price,
      packagingFee: item.packaging_fee,
      activePromotionLabel: undefined,
      isOverride: false
    };
  }

  let promoPrice = item.price;
  if (activePromo.priceAdjustmentType === 'fixed') {
    promoPrice = activePromo.priceAdjustmentValue;
  } else {
    const ratio = 1 + (activePromo.priceAdjustmentValue / 100);
    promoPrice = Math.round(item.price * ratio);
  }
  promoPrice = Math.max(0, promoPrice);

  let promoPackagingFee = item.packaging_fee;
  if (activePromo.packagingFeePolicy === 'free') {
    promoPackagingFee = 0;
  } else if (activePromo.packagingFeePolicy === 'discounted' && activePromo.priceAdjustmentType === 'percent' && activePromo.priceAdjustmentValue < 0) {
    const discountRatio = 1 + (activePromo.priceAdjustmentValue / 100);
    promoPackagingFee = Math.max(0, Math.round(item.packaging_fee * discountRatio));
  }

  return {
    price: promoPrice,
    packagingFee: promoPackagingFee,
    activePromotionLabel: activePromoLabel,
    isOverride
  };
}

function BrutalClosingAnimation({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const drawCtx: CanvasRenderingContext2D = ctx;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.onresize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
      gravity: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 9 + 4;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - Math.random() * 4;
        this.size = Math.random() * 4 + 2;
        const colors = ['#ff9f0a', '#0071e3', '#30d158', '#af52de', '#ff453a', '#ffffff'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.008;
        this.gravity = 0.12;
      }

      update() {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;
        this.alpha -= this.decay;
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.globalAlpha = Math.max(0, this.alpha);
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.shadowBlur = 8;
        c.shadowColor = this.color;
        c.fill();
        c.restore();
      }
    }

    const particles: Particle[] = [];

    // Spawn massive explosion
    for (let i = 0; i < 300; i++) {
      particles.push(new Particle(width / 2, height / 2));
    }

    let frame = 0;
    function loop() {
      drawCtx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      drawCtx.fillRect(0, 0, width, height);

      if (frame < 80 && Math.random() < 0.7) {
        for (let j = 0; j < 6; j++) {
          particles.push(new Particle(width / 2 + (Math.random() - 0.5) * 120, height / 2 + (Math.random() - 0.5) * 120));
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(drawCtx);
        if (p.alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      frame++;
      animationId = requestAnimationFrame(loop);
    }

    loop();

    const timer = setTimeout(() => {
      cancelAnimationFrame(animationId);
      onComplete();
    }, 4500);

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <div className="brutal-closing-overlay">
      <div className="shockwave-ring" />
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div className="brutal-closing-card">
        <div className="success-checkmark-wrapper">
          <Check size={40} strokeWidth={3} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
          NAPI ZÁRÁS SIKERESEN VÉGLEGESÍTVE!
        </h2>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '24px' }}>
          A mai nap összesítése sikeresen lementve az adatbázisba. A rendszer archiválta az aktív rendeléseket és inicializálta az új napot.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#30d158', fontSize: '12px', fontWeight: 600, justifyContent: 'center' }}>
          <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s infinite linear' }} />
          <span>Új nap indítása...</span>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Geocoding cache to save API credits and speed up queries
const geocodeCache: { [address: string]: [number, number] } = {};

export default function App() {
  // App States
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const [view, setView] = useState<'login' | 'menu' | 'admin'>('login');
  const [isEntranceAnimating, setIsEntranceAnimating] = useState(false);
  
  // Database State
  const [db, setDb] = useState<any>({
    users: [],
    categories: [],
    items: [],
    inventory: [],
    customers: [],
    orders: [],
    packagingFees: { pizza: 150, box: 200, cup: 0 },
    deliveryFees: {
      mode: 'manual',
      baseFee: 500,
      perKmFee: 100,
      googleApiKey: '',
      geoapifyApiKey: '',
      baseAddress: '',
      rounding: 'exact',
      settlements: [],
      minOrderAmount: 0,
      excludePackaging: false,
      excludeDelivery: false,
      excludeDiscount: false
    },
    welcomeAnimationEnabled: true,
    selectedPrinter: '',
    autoPrintOnOrder: true,
    enableStaffPortals: true,
    receiptConfig: {
      logoBase64: '',
      logoAlignment: 'center',
      logoPosition: 'top',
      logoScale: 50,
      headerText: 'PRÉMIUM PIZZÉRIA & ÉTTEREM\nTel: +36 30 123 4567\nAdószám: 12345678-2-12',
      footerText: 'Köszönjük a vásárlást!\nEgészségére!\nVárjuk vissza!',
      showOrderId: true,
      showTimestamp: true,
      showPaymentMethod: true,
      showCustomerDetails: true,
      showComment: true,
      showPackagingFee: true,
      showDeliveryFee: true,
      showDiscount: true,
      fontSize: 'medium',
      lineSpacing: 'normal'
    }
  });

  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [selectedConfigIndex, setSelectedConfigIndex] = useState(0);

  const refreshPrinters = () => {
    if (window.electronAPI?.getPrinters) {
      window.electronAPI.getPrinters().then((printers: any[]) => {
        if (printers && printers.length > 0) {
          setAvailablePrinters(printers.map((p: any) => p.name));
        } else {
          setAvailablePrinters([]);
        }
      }).catch((err: any) => {
        console.error("Error loading printers:", err);
        setAvailablePrinters([]);
      });
    } else {
      setAvailablePrinters(['Epson TM-T20II', 'Star TSP100', 'Microsoft Print to PDF', 'HP LaserJet 400']);
    }
  };

  useEffect(() => {
    refreshPrinters();
    const t = setTimeout(refreshPrinters, 1500);
    return () => clearTimeout(t);
  }, []);

  // Login Form States
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginFailedShake, setLoginFailedShake] = useState(false);
  const [isLoginFadingOut, setIsLoginFadingOut] = useState(false);
  const [showGreenRipple, setShowGreenRipple] = useState(false);
  const [hasTriggeredCorrectWave, setHasTriggeredCorrectWave] = useState(false);

  // Ordering Menu States
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  
  // Modals / Selection States
  const [isCustomerViewActive, setIsCustomerViewActive] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomerIdForEdit, setSelectedCustomerIdForEdit] = useState<string | null>(null);
  const [editingCustomerData, setEditingCustomerData] = useState<Customer | null>(null);
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [apiCalculatedDistance, setApiCalculatedDistance] = useState<number | null>(null);
  const [selectedCartCustomerId, setSelectedCartCustomerId] = useState<string | null>(null);
  
  const [isPaymentViewActive, setIsPaymentViewActive] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Készpénz' | 'Bankkártya' | 'SZÉP Kártya' | 'Ajándékutalvány' | 'Számla' | 'Később fizet' | 'Bontott fizetés'>('Készpénz');
  
  // States for Split Payment
  const [splitGroups, setSplitGroups] = useState<{ id: number; name: string; paymentMethod: string }[]>([
    { id: 1, name: '1. Vendég', paymentMethod: 'Készpénz' },
    { id: 2, name: '2. Vendég', paymentMethod: 'Bankkártya' }
  ]);
  const [splitAssignments, setSplitAssignments] = useState<{ [key: string]: number }>({});
  
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [showTodayOrdersModal, setShowTodayOrdersModal] = useState(false);
  const [selectedDetailOrderId, setSelectedDetailOrderId] = useState<number | null>(null);
  const [showMenuWizardModal, setShowMenuWizardModal] = useState(false);
  const [wizardCategory, setWizardCategory] = useState<Category | null>(null);
  const [wizardCourseIndex, setWizardCourseIndex] = useState(0);
  const [wizardChoices, setWizardChoices] = useState<MenuCourseChoice[]>([]);

  // Active Order Selection (for detail preview if clicked)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Custom Confirm Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState('Megerősítés');
  const [confirmModalMessage, setConfirmModalMessage] = useState('');
  const [confirmButtonText, setConfirmButtonText] = useState('Törlés');
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

  const customConfirm = (message: string, onConfirm: () => void, title: string = 'Biztos vagy benne?', buttonText: string = 'Törlés') => {
    setConfirmModalTitle(title);
    setConfirmModalMessage(message);
    setConfirmButtonText(buttonText);
    setOnConfirmAction(() => onConfirm);
    setShowConfirmModal(true);
  };

  // Admin Panel States
  const [adminTab, setAdminTab] = useState<'stats' | 'menu' | 'packaging' | 'inventory' | 'permissions' | 'dispatch' | 'delivery' | 'history' | 'schedule' | 'settings'>('stats');
  
  // Admin Editing States
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number | ''>('');
  const [newItemPackFee, setNewItemPackFee] = useState<number | ''>('');
  const [newItemPackType, setNewItemPackType] = useState<string>('none');
  const [newItemCatId, setNewItemCatId] = useState(1);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemIngredients, setNewItemIngredients] = useState<{ ingredientId: number; quantity: number }[]>([]);

  // Tracking last added new item properties for defaults
  const [lastAddedCatId, setLastAddedCatId] = useState<number>(1);
  const [lastAddedPackType, setLastAddedPackType] = useState<string>('none');
  const [lastAddedPackFee, setLastAddedPackFee] = useState<number>(0);

  // States for adding a single ingredient inside the form
  const [selectedAddIngredientId, setSelectedAddIngredientId] = useState<number | null>(null);
  const [selectedAddIngredientQty, setSelectedAddIngredientQty] = useState<number | ''>('');

  // New Detailed Inventory/Warehouse States
  const [inventorySubTab, setInventorySubTab] = useState<'items' | 'categories' | 'suppliers'>('items');
  const [editingInvItem, setEditingInvItem] = useState<any | null>(null);
  const [editingInvCat, setEditingInvCat] = useState<any | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);

  // Form bindings for Inventory Item modal
  const [invItemName, setInvItemName] = useState('');
  const [invItemCategoryId, setInvItemCategoryId] = useState<number | 'none'>('none');
  const [invItemQuantity, setInvItemQuantity] = useState<number | ''>('');
  const [invItemUnit, setInvItemUnit] = useState('kg');
  const [invItemWarningLimit, setInvItemWarningLimit] = useState<number | ''>('');
  const [invItemSupplierId, setInvItemSupplierId] = useState('');
  const [invItemFreqValue, setInvItemFreqValue] = useState<number | ''>(7);
  const [invItemFreqUnit, setInvItemFreqUnit] = useState<'day' | 'week'>('day');
  const [invItemProcurement, setInvItemProcurement] = useState(false);
  const [invItemDoubleExtraPrice, setInvItemDoubleExtraPrice] = useState<number | ''>(0);

  // Form bindings for Inventory Category modal
  const [invCatName, setInvCatName] = useState('');
  const [invCatDescription, setInvCatDescription] = useState('');

  // Form bindings for Supplier modal
  const [supplierName, setSupplierName] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierDescription, setSupplierDescription] = useState('');

  const [pdfItems, setPdfItems] = useState<Array<{ id: number; raw_name: string; quantity: number; unit: string; matched_item_id: number | null }>>([]);
  const [feltoltesRawText, setFeltoltesRawText] = useState<string>('');

  const parsePdfTextToItems = (text: string, inventory: any[], aliases: any[]) => {
    const lines = text.split('\n');
    const itemsList: Array<{ id: number; raw_name: string; quantity: number; unit: string; matched_item_id: number | null }> = [];
    let idCounter = 1;

    // Regex 1: Metro invoice columns layout: Barcode, VTSZ, Description, Unit, Db/Csom, Mennyiség
    const metroRegex = /^(\+?\d+)\s+(\d+)\s+(.+?)\s+([A-Z]{2,6})\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)/i;
    // Regex 2: Legacy fallback format: Description Quantity Unit
    const legacyRegex = /(.+?)\s+(\d+(?:[.,]\d+)?)\s*(db|kg|g|l|liter|üveg|csomag|karton|szál|pohár)\b/i;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('összesen') || lowerLine.includes('végösszeg') || lowerLine.includes('nettó') || lowerLine.includes('bruttó') || lowerLine.includes('áfa')) {
        continue;
      }

      // Try matching Metro layout first
      const metroMatch = line.match(metroRegex);
      if (metroMatch) {
        const rawName = metroMatch[3].trim();
        const dbCsom = parseFloat(metroMatch[5].replace(',', '.'));
        const quantityVal = parseFloat(metroMatch[6].replace(',', '.'));
        const unit = metroMatch[4].toLowerCase();
        
        // Compute total quantity rounded to 3 decimals
        const quantity = Math.round(dbCsom * quantityVal * 1000) / 1000;

        let cleanName = rawName.replace(/^\d+[\s\.\)-]+/, '').trim();
        if (cleanName.length < 2 || /^\d+$/.test(cleanName)) {
          continue;
        }

        const isDuplicate = itemsList.some(item => item.raw_name === cleanName && item.quantity === quantity);
        if (isDuplicate) continue;

        let matchedId: number | null = null;
        const aliasObj = (aliases || []).find(a => a.raw_name.toLowerCase() === cleanName.toLowerCase());
        if (aliasObj) {
          matchedId = aliasObj.inventory_item_id;
        } else {
          const exactInv = (inventory || []).find(inv => inv.name.toLowerCase() === cleanName.toLowerCase() && inv.is_active !== false);
          if (exactInv) {
            matchedId = exactInv.id;
          } else {
            const fuzzyInv = (inventory || []).find(inv => {
              if (inv.is_active === false) return false;
              const invLower = inv.name.toLowerCase();
              const cleanLower = cleanName.toLowerCase();
              return cleanLower.includes(invLower) || invLower.includes(cleanLower);
            });
            if (fuzzyInv) {
              matchedId = fuzzyInv.id;
            }
          }
        }

        itemsList.push({
          id: idCounter++,
          raw_name: cleanName,
          quantity,
          unit,
          matched_item_id: matchedId
        });
      } else {
        // Fallback to legacy layout
        const legacyMatch = line.match(legacyRegex);
        if (legacyMatch) {
          const rawName = legacyMatch[1].trim();
          const qtyStr = legacyMatch[2].replace(',', '.');
          const quantity = parseFloat(qtyStr);
          const unit = legacyMatch[3].toLowerCase();

          let cleanName = rawName.replace(/^\d+[\s\.\)-]+/, '').trim();
          if (cleanName.length < 2 || /^\d+$/.test(cleanName)) {
            continue;
          }

          const isDuplicate = itemsList.some(item => item.raw_name === cleanName && item.quantity === quantity);
          if (isDuplicate) continue;

          let matchedId: number | null = null;
          const aliasObj = (aliases || []).find(a => a.raw_name.toLowerCase() === cleanName.toLowerCase());
          if (aliasObj) {
            matchedId = aliasObj.inventory_item_id;
          } else {
            const exactInv = (inventory || []).find(inv => inv.name.toLowerCase() === cleanName.toLowerCase() && inv.is_active !== false);
            if (exactInv) {
              matchedId = exactInv.id;
            } else {
              const fuzzyInv = (inventory || []).find(inv => {
                if (inv.is_active === false) return false;
                const invLower = inv.name.toLowerCase();
                const cleanLower = cleanName.toLowerCase();
                return cleanLower.includes(invLower) || invLower.includes(cleanLower);
              });
              if (fuzzyInv) {
                matchedId = fuzzyInv.id;
              }
            }
          }

          itemsList.push({
            id: idCounter++,
            raw_name: cleanName,
            quantity,
            unit,
            matched_item_id: matchedId
          });
        }
      }
    }

    return itemsList;
  };

  // Raktár Feltöltés (Beszállítás) States
  const [showRaktarFeltoltesModal, setShowRaktarFeltoltesModal] = useState(false);
  const [feltoltesSupplierId, setFeltoltesSupplierId] = useState('');
  const [feltoltesInvoiceNum, setFeltoltesInvoiceNum] = useState('');
  const [feltoltesMode, setFeltoltesMode] = useState<'manual' | 'auto'>('manual');
  const [feltoltesSelectedCategory, setFeltoltesSelectedCategory] = useState<number | 'all'>('all');
  const [feltoltesSearchQuery, setFeltoltesSearchQuery] = useState('');
  const [feltoltesSelectedItem, setFeltoltesSelectedItem] = useState<any | null>(null);
  const [feltoltesAddQty, setFeltoltesAddQty] = useState<number>(0);
  const [feltoltesItemsList, setFeltoltesItemsList] = useState<Array<{ inventory_item_id: number; name: string; quantity: number; unit: string }>>([]);
  const [isAnalyzingInvoice, setIsAnalyzingInvoice] = useState(false);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);
  const [feltoltesUploadedFileName, setFeltoltesUploadedFileName] = useState<string | null>(null);
  const [showFeltoltesSuccessCard, setShowFeltoltesSuccessCard] = useState(false);
  const [feltoltesSearchDropdownOpen, setFeltoltesSearchDropdownOpen] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [feltoltesOpenDropdown, setFeltoltesOpenDropdown] = useState<'supplier' | 'category' | null>(null);
  
  // Custom dropdown open states for all native select refactoring
  const [openPrefixDropdown, setOpenPrefixDropdown] = useState(false);
  const [openItemCatDropdown, setOpenItemCatDropdown] = useState(false);
  const [openItemPackDropdown, setOpenItemPackDropdown] = useState(false);
  const [openItemIngredDropdown, setOpenItemIngredDropdown] = useState(false);
  const [openInvCatDropdown, setOpenInvCatDropdown] = useState(false);
  const [openInvSupplierDropdown, setOpenInvSupplierDropdown] = useState(false);
  const [openInvFreqDropdown, setOpenInvFreqDropdown] = useState(false);
  const [openRoundingDropdown, setOpenRoundingDropdown] = useState(false);
  const [openSplitPayDropdown, setOpenSplitPayDropdown] = useState<number | null>(null);

  // Web Portal Simulator States
  const [portalUser, setPortalUser] = useState<UserItem | null>(null);
  const [portalView, setPortalView] = useState<'kitchen' | 'courier' | 'landing'>('landing');
  const [activeSessions, setActiveSessions] = useState<WebSession[]>([]);
  const [portalLoginUsername, setPortalLoginUsername] = useState('');
  const [portalLoginPassword, setPortalLoginPassword] = useState('');
  const [portalLoginError, setPortalLoginError] = useState('');
  const [portalOrderDetailsId, setPortalOrderDetailsId] = useState<number | null>(null);
  const [portalCookTimerMins, setPortalCookTimerMins] = useState<number>(20);
  const [portalCookCourierId, setPortalCookCourierId] = useState<number | null>(null);
  const [portalCourierFilter, setPortalCourierFilter] = useState<'all_progress' | 'all_delivery' | 'my_orders'>('all_progress');

  // Cart Item Customization States
  const [editingCartItem, setEditingCartItem] = useState<OrderItem | null>(null);
  const [editPortion, setEditPortion] = useState<'full' | 'half'>('full');
  const [editIngredientAdjustments, setEditIngredientAdjustments] = useState<{ [ingredientId: number]: 'none' | 'normal' | 'double' }>({});
  const [editNote, setEditNote] = useState('');
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editLinkedItem, setEditLinkedItem] = useState<MenuItem | null>(null);

  // Attachment Selector States for Main Menu click
  const [attachingMenuItem, setAttachingMenuItem] = useState<MenuItem | null>(null);
  const [selectedAttachmentItem, setSelectedAttachmentItem] = useState<MenuItem | null>(null);

  // Scheduler States
  const [scheduleYear, setScheduleYear] = useState<number>(new Date().getFullYear());
  const [scheduleMonth, setScheduleMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<string | null>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [newShiftUserId, setNewShiftUserId] = useState<number | ''>('');
  const [newShiftStartTime, setNewShiftStartTime] = useState('11:00');
  const [newShiftEndTime, setNewShiftEndTime] = useState('21:00');
  const [newShiftRoles, setNewShiftRoles] = useState<string[]>([]);
  const [openShiftUserDropdown, setOpenShiftUserDropdown] = useState(false);

  // User Management States
  const [editingUserItem, setEditingUserItem] = useState<UserItem | 'NEW' | null>(null);
  const [userEditName, setUserEditName] = useState('');
  const [userEditPhone, setUserEditPhone] = useState('');
  const [userEditUsername, setUserEditUsername] = useState('');
  const [userEditPassword, setUserEditPassword] = useState('');
  const [userEditDesktopRole, setUserEditDesktopRole] = useState<'admin' | 'staff'>('staff');
  const [userEditWebRoles, setUserEditWebRoles] = useState<string[]>([]);
  const [userEditColor, setUserEditColor] = useState('#bf5af2');
  const [userEditSymbol, setUserEditSymbol] = useState('User');

  // Packaging Edit States
  const [editingPackKey, setEditingPackKey] = useState<string | null>(null);
  const [newPackName, setNewPackName] = useState('');
  const [newPackPrice, setNewPackPrice] = useState<number | ''>('');

  // Category Edit States
  const [menuSubTab, setMenuSubTab] = useState<'items' | 'categories'>('items');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [newCatLinkedCategoryId, setNewCatLinkedCategoryId] = useState<number | 'none'>('none');
  const [newCatIncludeLinkedPackagingFee, setNewCatIncludeLinkedPackagingFee] = useState(false);
  const [openCatLinkDropdown, setOpenCatLinkDropdown] = useState(false);
  const [newCatIsMenuCategory, setNewCatIsMenuCategory] = useState(false);
  const [newCatCourses, setNewCatCourses] = useState<CourseDefinition[]>([]);
  const [newCatScheduleDays, setNewCatScheduleDays] = useState<number[]>([]);
  const [newCatScheduleFrom, setNewCatScheduleFrom] = useState('');
  const [newCatScheduleTo, setNewCatScheduleTo] = useState('');

  // Promotion Edit States
  const [promoIsEnabled, setPromoIsEnabled] = useState(false);
  const [promoType, setPromoType] = useState<'once' | 'recurring'>('recurring');
  const [promoOnceDate, setPromoOnceDate] = useState('');
  const [promoRecurringDays, setPromoRecurringDays] = useState<number[]>([]);
  const [promoRecurringWeeksInterval, setPromoRecurringWeeksInterval] = useState(1);
  const [promoRecurringStartDate, setPromoRecurringStartDate] = useState('');
  const [promoPriceAdjustmentType, setPromoPriceAdjustmentType] = useState<'percent' | 'fixed'>('percent');
  const [promoPriceAdjustmentValue, setPromoPriceAdjustmentValue] = useState<number | ''>('');
  const [promoPackagingFeePolicy, setPromoPackagingFeePolicy] = useState<'standard' | 'free' | 'discounted'>('standard');
  const [openPromoTypeDropdown, setOpenPromoTypeDropdown] = useState(false);
  const [openPromoPriceDropdown, setOpenPromoPriceDropdown] = useState(false);
  const [openPromoPackDropdown, setOpenPromoPackDropdown] = useState(false);

  const [editingItemTab, setEditingItemTab] = useState<'general' | 'promo' | 'ingredients'>('general');
  const [editingCategoryTab, setEditingCategoryTab] = useState<'general' | 'promo' | 'menu_mode'>('general');
  const catModalContentRef = useRef<HTMLDivElement>(null);
  const [catModalHeight, setCatModalHeight] = useState<number>(350);

  useEffect(() => {
    if (!editingCategory || !catModalContentRef.current) return;
    const updateHeight = () => {
      if (catModalContentRef.current) {
        setCatModalHeight(catModalContentRef.current.scrollHeight);
      }
    };
    
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(catModalContentRef.current);
    
    const timer = setTimeout(updateHeight, 80);
    
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, [editingCategory, editingCategoryTab, promoIsEnabled, newCatIsMenuCategory, newCatCourses, newCatScheduleDays]);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const [tabHeight, setTabHeight] = useState<number>(300);

  useEffect(() => {
    if (!editingItem || !tabContentRef.current) return;
    const updateHeight = () => {
      if (tabContentRef.current) {
        setTabHeight(tabContentRef.current.scrollHeight);
      }
    };
    
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(tabContentRef.current);
    
    const timer = setTimeout(updateHeight, 80);
    
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, [editingItem, editingItemTab, promoIsEnabled, newItemIngredients]);

  useEffect(() => {
    const promo = editingItem ? editingItem.promotion : (editingCategory ? editingCategory.promotion : undefined);
    if (promo) {
      setPromoIsEnabled(promo.isEnabled);
      setPromoType(promo.type || 'recurring');
      setPromoOnceDate(promo.onceDate || '');
      setPromoRecurringDays(promo.recurringDays || []);
      setPromoRecurringWeeksInterval(promo.recurringWeeksInterval || 1);
      setPromoRecurringStartDate(promo.recurringStartDate || '');
      setPromoPriceAdjustmentType(promo.priceAdjustmentType || 'percent');
      setPromoPriceAdjustmentValue(promo.priceAdjustmentValue || 0);
      setPromoPackagingFeePolicy(promo.packagingFeePolicy || 'standard');
    } else {
      setPromoIsEnabled(false);
      setPromoType('recurring');
      setPromoOnceDate('');
      setPromoRecurringDays([]);
      setPromoRecurringWeeksInterval(1);
      const todayYmd = new Date().toISOString().split('T')[0];
      setPromoRecurringStartDate(todayYmd);
      setPromoPriceAdjustmentType('percent');
      setPromoPriceAdjustmentValue(0);
      setPromoPackagingFeePolicy('standard');
    }

    if (editingCategory) {
      setNewCatIsMenuCategory(editingCategory.is_menu_category || false);
      setNewCatCourses(editingCategory.courses || []);
      setNewCatScheduleDays(editingCategory.menu_schedule?.days || []);
      setNewCatScheduleFrom(editingCategory.menu_schedule?.fromTime || '');
      setNewCatScheduleTo(editingCategory.menu_schedule?.toTime || '');
    } else {
      setNewCatIsMenuCategory(false);
      setNewCatCourses([]);
      setNewCatScheduleDays([]);
      setNewCatScheduleFrom('');
      setNewCatScheduleTo('');
    }
  }, [editingItem, editingCategory]);

  // Food Item Filter States
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterCategory, setFilterCategory] = useState<number | 'all'>('all');
  const [filterMinPrice, setFilterMinPrice] = useState<number | ''>('');
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | ''>('');
  const [filterPackType, setFilterPackType] = useState<string | 'all'>('all');
  const [filterAllergen, setFilterAllergen] = useState<string | 'all'>('all');
  const [openDropdown, setOpenDropdown] = useState<'status' | 'category' | 'pack' | 'allergen' | null>(null);

  // Daily Close States
  const [startupTime] = useState<Date>(new Date());
  const [showDailyCloseModal, setShowDailyCloseModal] = useState(false);
  const [isClosingDayAnimationActive, setIsClosingDayAnimationActive] = useState(false);
  const [expandedCloseId, setExpandedCloseId] = useState<number | null>(null);

  // Delivery Fee Admin States
  const [editingSettlement, setEditingSettlement] = useState<any | null>(null);
  const [newSettlementZip, setNewSettlementZip] = useState('');
  const [newSettlementCity, setNewSettlementCity] = useState('');
  const [newSettlementDistance, setNewSettlementDistance] = useState<number | ''>('');
  const [newSettlementFixedFee, setNewSettlementFixedFee] = useState<number | ''>('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Free Delivery Settlement Admin States
  const [editingFreeSettlement, setEditingFreeSettlement] = useState<any | null>(null);
  const [newFreeSettlementZip, setNewFreeSettlementZip] = useState('');
  const [newFreeSettlementCity, setNewFreeSettlementCity] = useState('');

  // Chatbot States
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { 
      id: 1, 
      sender: 'bot', 
      text: 'Szia! Én az ételrendelő program intelligens asszisztense vagyok. Kérdezhetsz tőlem a program használatáról, felvihetsz rendeléseket (pl.: "15. pizza extra sajttal..."), vagy adminként módosíthatsz árakat és étlapot is. Miben segíthetek?', 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }
  ]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const promoPanelRef = useRef<HTMLDivElement>(null);
  const loginContainerRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatbotOpen]);

  // Aligned/Physical Login Rope States and Effects
  const [mousePos, setMousePos] = useState({ x: 200, y: 0 });
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const [ropeCtrl, setRopeCtrl] = useState({ x: 200, y: 100 });
  
  const ctrlPhysics = useRef({ x: 200, y: 100, vx: 0, vy: 0 });
  const mousePosRef = useRef({ x: 200, y: 0 });
  const targetPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    mousePosRef.current = mousePos;
  }, [mousePos]);

  useEffect(() => {
    targetPosRef.current = targetPos;
  }, [targetPos]);

  // Update target coordinates
  const updateTargetPos = () => {
    if (!loginContainerRef.current) return;
    const containerRect = loginContainerRef.current.getBoundingClientRect();
    
    let activeRef: React.RefObject<any> = usernameInputRef;
    if (loginUsername.trim().length > 0 && !loginPassword.trim()) {
      activeRef = passwordInputRef;
    } else if (loginUsername.trim().length > 0 && loginPassword.trim().length > 0) {
      activeRef = submitButtonRef;
    }
    
    if (activeRef.current) {
      const rect = activeRef.current.getBoundingClientRect();
      setTargetPos({
        x: (rect.left + rect.right) / 2 - containerRect.left,
        y: (rect.top + rect.bottom) / 2 - containerRect.top
      });
    }
  };

  // Run updateTargetPos when states or view shifts
  useEffect(() => {
    if (view === 'login') {
      const t = setTimeout(updateTargetPos, 50);
      return () => clearTimeout(t);
    }
  }, [view, loginUsername, loginPassword]);

  // Window resize handler
  useEffect(() => {
    if (view === 'login') {
      window.addEventListener('resize', updateTargetPos);
      return () => window.removeEventListener('resize', updateTargetPos);
    }
  }, [view, loginUsername, loginPassword]);

  // Physics animation loop for control point
  useEffect(() => {
    if (view !== 'login') return;

    let animId: number;
    const physics = ctrlPhysics.current;
    
    physics.x = (mousePosRef.current.x + targetPosRef.current.x) / 2;
    physics.y = (mousePosRef.current.y + targetPosRef.current.y) / 2 + 100;
    physics.vx = 0;
    physics.vy = 0;
    
    const loop = () => {
      const m = mousePosRef.current;
      const t = targetPosRef.current;
      
      const restX = (m.x + t.x) / 2;
      const dx = t.x - m.x;
      const dy = t.y - m.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const gravity = Math.max(40, 140 - dist * 0.12);
      const restY = (m.y + t.y) / 2 + gravity;
      
      const k = 0.055;
      const damping = 0.83;
      
      const ax = (restX - physics.x) * k;
      const ay = (restY - physics.y) * k;
      
      physics.vx = (physics.vx + ax) * damping;
      physics.vy = (physics.vy + ay) * damping;
      
      physics.x += physics.vx;
      physics.y += physics.vy;
      
      if (!isNaN(physics.x) && !isNaN(physics.y)) {
        setRopeCtrl({ x: physics.x, y: physics.y });
      }
      
      animId = requestAnimationFrame(loop);
    };
    
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [view]);

  // Dynamic correct credentials green ripple detector
  useEffect(() => {
    if (view !== 'login' || !db.users || db.users.length === 0) return;
    
    const matched = db.users.find(
      (u: any) => u.username.trim().toLowerCase() === loginUsername.trim().toLowerCase() && 
                  u.password?.trim().toLowerCase() === loginPassword.trim().toLowerCase()
    );

    if (matched) {
      if (!hasTriggeredCorrectWave) {
        setShowGreenRipple(true);
        setHasTriggeredCorrectWave(true);
        const t = setTimeout(() => setShowGreenRipple(false), 900);
        return () => clearTimeout(t);
      }
    } else {
      setHasTriggeredCorrectWave(false);
      setShowGreenRipple(false);
    }
  }, [loginUsername, loginPassword, db.users, view]);

  // Load and sync database using Server-Sent Events (SSE) for instant real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackInterval: any = null;

    const applyDbUpdate = (data: any) => {
      if (data && data.users) {
        setDb((prev: any) => {
          const changed = JSON.stringify(prev.orders) !== JSON.stringify(data.orders) ||
                          JSON.stringify(prev.users) !== JSON.stringify(data.users) ||
                          JSON.stringify(prev.shifts) !== JSON.stringify(data.shifts) ||
                          JSON.stringify(prev.inventory) !== JSON.stringify(data.inventory) ||
                          JSON.stringify(prev.items) !== JSON.stringify(data.items);
          if (changed) {
            return {
              ...prev,
              ...data,
              restrictLoginToSchedule: data.restrictLoginToSchedule !== undefined ? data.restrictLoginToSchedule : false,
              couriersCanReassign: data.couriersCanReassign !== undefined ? data.couriersCanReassign : false,
              welcomeAnimationEnabled: data.welcomeAnimationEnabled !== undefined ? data.welcomeAnimationEnabled : true,
            };
          }
          return prev;
        });
        if (!window.electronAPI) {
          localStorage.setItem('sd_order_system_db', JSON.stringify(data));
        }
      }
    };

    const connectSSE = () => {
      try {
        eventSource = new EventSource('http://localhost:3001/api/events');
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            applyDbUpdate(data);
          } catch (err) {
            console.error("SSE JSON parse error:", err);
          }
        };

        eventSource.onerror = (err) => {
          console.warn("SSE connection closed or failed. Falling back to polling...", err);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          startFallbackPoller();
        };
      } catch (e) {
        console.error("Failed to initialize SSE EventSource:", e);
        startFallbackPoller();
      }
    };

    const startFallbackPoller = () => {
      if (fallbackInterval) return;
      
      const poll = async () => {
        if (window.electronAPI) {
          try {
            const data = await window.electronAPI.dbLoad();
            applyDbUpdate(data);
          } catch (err) {
            console.error("IPC fallback sync error:", err);
          }
        } else {
          try {
            const res = await fetch('http://localhost:3001/api/db');
            if (res.ok) {
              const data = await res.json();
              applyDbUpdate(data);
            }
          } catch (err) {
            const localDataStr = localStorage.getItem('sd_order_system_db');
            if (localDataStr) {
              applyDbUpdate(JSON.parse(localDataStr));
            }
          }
        }
      };

      poll();
      fallbackInterval = setInterval(poll, 3000);
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  // Save database helper (with real-time API syncing for browser)
  const saveDatabase = async (newDb: any) => {
    if (db?.inventory && newDb?.inventory) {
      const newlyWarned: string[] = [];
      newDb.inventory.forEach((newItem: any) => {
        const oldItem = db.inventory.find((i: any) => i.id === newItem.id);
        if (oldItem) {
          const oldQty = oldItem.quantity;
          const newQty = newItem.quantity;
          const limit = newItem.warning_limit || 0;
          if (oldQty > limit && newQty <= limit) {
            newlyWarned.push(`- ${newItem.name} (Aktuális készlet: ${newQty} ${newItem.unit || 'egység'}, limit: ${limit} ${newItem.unit || 'egység'})`);
          }
        }
      });
      if (newlyWarned.length > 0) {
        setTimeout(() => {
          alert(`⚠️ RAKTÁR FIGYELMEZTETÉS!\n\nAz alábbi alapanyag(ok) elérte(k) vagy átlépte(k) a figyelmeztetési limitet:\n\n${newlyWarned.join('\n')}`);
        }, 100);
      }
    }

    setDb(newDb);
    if (window.electronAPI) {
      await window.electronAPI.dbSave(newDb);
    } else {
      localStorage.setItem('sd_order_system_db', JSON.stringify(newDb));
      try {
        await fetch('http://localhost:3001/api/db', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newDb)
        });
      } catch (err) {
        console.error("HTTP sync save error:", err);
      }
    }
  };

  useEffect(() => {
    if (editingUserItem && editingUserItem !== 'NEW') {
      setUserEditName(editingUserItem.name);
      setUserEditPhone(editingUserItem.phone_number || '');
      setUserEditUsername(editingUserItem.username);
      setUserEditPassword(editingUserItem.password || '');
      setUserEditDesktopRole(editingUserItem.role);
      setUserEditWebRoles(editingUserItem.web_roles || []);
      setUserEditColor(editingUserItem.color || '#bf5af2');
      setUserEditSymbol(editingUserItem.symbol || 'User');
    } else if (editingUserItem === 'NEW') {
      setUserEditName('');
      setUserEditPhone('');
      setUserEditUsername('');
      setUserEditPassword('');
      setUserEditDesktopRole('staff');
      setUserEditWebRoles([]);
      setUserEditColor('#bf5af2');
      setUserEditSymbol('User');
    }
  }, [editingUserItem]);

  // Real-time Web Portal Session Sync
  useEffect(() => {
    if (portalUser) {
      const dbUser = db.users.find((u: any) => u.id === portalUser.id);
      
      // 1. Kick if deleted or banned
      if (!dbUser || dbUser.is_banned) {
        setPortalUser(null);
        setPortalView('landing');
        setPortalLoginError(!dbUser ? 'A fiókodat törölték!' : 'A fiókodat kitiltották!');
        setActiveSessions(prev => prev.filter(s => s.userId !== portalUser.id));
        return;
      }

      // 2. Kick if disconnected from active sessions list
      const isSessionActive = activeSessions.some(s => s.userId === portalUser.id);
      if (!isSessionActive) {
        setPortalUser(null);
        setPortalView('landing');
        setPortalLoginError('A diszpécser lecsatlakoztatott!');
        return;
      }

      // 3. Kick if active role was megvonva (removed)
      const hasKitchenRole = dbUser.web_roles?.includes('Szakács');
      const hasCourierRole = dbUser.web_roles?.includes('Futár');
      
      if (portalView === 'kitchen' && !hasKitchenRole) {
        if (hasCourierRole) {
          setPortalView('landing');
        } else {
          setPortalUser(null);
          setPortalView('landing');
          setPortalLoginError('Megvonták a Szakács jogosultságodat!');
          setActiveSessions(prev => prev.filter(s => s.userId !== portalUser.id));
        }
      } else if (portalView === 'courier' && !hasCourierRole) {
        if (hasKitchenRole) {
          setPortalView('landing');
        } else {
          setPortalUser(null);
          setPortalView('landing');
          setPortalLoginError('Megvonták a Futár jogosultságodat!');
          setActiveSessions(prev => prev.filter(s => s.userId !== portalUser.id));
        }
      } else if (portalView === 'landing' && !hasKitchenRole && !hasCourierRole) {
        setPortalUser(null);
        setPortalView('landing');
        setPortalLoginError('Nincs érvényes beosztásod/jogod a belépéshez!');
        setActiveSessions(prev => prev.filter(s => s.userId !== portalUser.id));
      }
    }
  }, [db.users, activeSessions, portalView, portalUser]);

  const handleSaveUser = () => {
    if (!userEditName.trim() || !userEditUsername.trim()) {
      alert('Név és felhasználónév kitöltése kötelező!');
      return;
    }
    
    const usernameTaken = db.users.some(
      (u: any) => u.username.toLowerCase() === userEditUsername.trim().toLowerCase() && 
      (editingUserItem === 'NEW' || u.id !== (editingUserItem as UserItem).id)
    );
    if (usernameTaken) {
      alert('Ez a felhasználónév már foglalt!');
      return;
    }

    let updatedUsers = [...db.users];
    
    if (editingUserItem === 'NEW') {
      const newId = db.users.length > 0 ? Math.max(...db.users.map((u: any) => u.id)) + 1 : 1;
      const newUser: UserItem = {
        id: newId,
        name: userEditName.trim(),
        phone_number: userEditPhone.trim(),
        username: userEditUsername.trim(),
        password: userEditPassword.trim() || userEditUsername.trim(),
        role: userEditDesktopRole,
        web_roles: userEditWebRoles,
        color: userEditColor,
        symbol: userEditSymbol,
        is_banned: false
      };
      updatedUsers.push(newUser);
    } else {
      updatedUsers = db.users.map((u: any) => (editingUserItem && u.id === editingUserItem.id) ? {
        ...u,
        name: userEditName.trim(),
        phone_number: userEditPhone.trim(),
        username: userEditUsername.trim(),
        password: userEditPassword.trim(),
        role: userEditDesktopRole,
        web_roles: userEditWebRoles,
        color: userEditColor,
        symbol: userEditSymbol
      } : u);
    }
    
    saveDatabase({ ...db, users: updatedUsers });
    setEditingUserItem(null);
  };

  const handleDeleteUser = (userId: number) => {
    if (userId === currentUser?.id) {
      alert('Nem törölheted a saját fiókodat, amivel be vagy jelentkezve!');
      return;
    }
    customConfirm('Biztosan törölni szeretnéd ezt a felhasználót?', () => {
      const updatedUsers = db.users.filter((u: any) => u.id !== userId);
      setActiveSessions(prev => prev.filter(s => s.userId !== userId));
      saveDatabase({ ...db, users: updatedUsers });
      setEditingUserItem(null);
    });
  };

  const handleAddShift = () => {
    if (!newShiftUserId) {
      alert('Válassz ki egy munkatársat!');
      return;
    }
    if (!selectedScheduleDay) {
      alert('Válassz ki egy napot!');
      return;
    }
    
    const startNum = parseInt(newShiftStartTime.replace(':', ''));
    const endNum = parseInt(newShiftEndTime.replace(':', ''));
    if (startNum >= endNum) {
      alert('A kezdési időpontnak korábban kell lennie, mint a befejezés!');
      return;
    }

    const user = db.users.find((u: any) => u.id === Number(newShiftUserId));
    if (!user) return;
    
    const roles = newShiftRoles.length > 0 ? newShiftRoles : user.web_roles;
    if (!roles || roles.length === 0) {
      alert('Ennek a felhasználónak nincsenek beállítva munkakörök! Először állítsd be őket a Jogosultságoknál.');
      return;
    }

    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      userId: Number(newShiftUserId),
      date: selectedScheduleDay,
      startTime: newShiftStartTime,
      endTime: newShiftEndTime,
      roles: roles
    };

    const updatedShifts = [...(db.shifts || []), newShift];
    saveDatabase({ ...db, shifts: updatedShifts });
    
    setNewShiftUserId('');
    setNewShiftRoles([]);
  };

  const handleDeleteShift = (shiftId: string) => {
    customConfirm('Biztosan törölni szeretnéd ezt a beosztást?', () => {
      const updatedShifts = (db.shifts || []).filter((s: any) => s.id !== shiftId);
      saveDatabase({ ...db, shifts: updatedShifts });
    });
  };

  const handleKickUser = (userId: number) => {
    setActiveSessions(prev => prev.filter(s => s.userId !== userId));
  };

  const handleToggleBanUser = (userId: number) => {
    const updatedUsers = db.users.map((u: any) => u.id === userId ? { ...u, is_banned: !u.is_banned } : u);
    saveDatabase({ ...db, users: updatedUsers });
    const targetUser = updatedUsers.find((u: any) => u.id === userId);
    if (targetUser && targetUser.is_banned) {
      setActiveSessions(prev => prev.filter(s => s.userId !== userId));
    }
  };

  const handlePortalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setPortalLoginError('');

    const username = portalLoginUsername.trim().toLowerCase();
    const user = db.users.find(
      (u: any) => u.username.toLowerCase() === username && u.password === portalLoginPassword
    );
    
    if (!user) {
      setPortalLoginError('Hibás felhasználónév vagy jelszó!');
      return;
    }
    
    if (user.is_banned) {
      setPortalLoginError('A fiókod ki van tiltva!');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isScheduledToday = (db.shifts || []).some(
      (s: any) => s.userId === user.id && s.date === todayStr
    );

    if (db.restrictLoginToSchedule && !isScheduledToday && user.role !== 'admin') {
      setPortalLoginError('Ma nem vagy beosztva munkára!');
      return;
    }

    if (!user.web_roles || user.web_roles.length === 0) {
      setPortalLoginError('Nincs beállított munkaköröd a portálhoz!');
      return;
    }

    setPortalUser(user);
    setPortalLoginUsername('');
    setPortalLoginPassword('');
    
    setActiveSessions(prev => [
      ...prev.filter(s => s.userId !== user.id),
      {
        userId: user.id,
        loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        activeView: 'landing'
      }
    ]);

    if (user.web_roles.length === 1) {
      if (user.web_roles[0] === 'Szakács') {
        setPortalView('kitchen');
      } else if (user.web_roles[0] === 'Futár') {
        setPortalView('courier');
      } else {
        setPortalView('landing');
      }
    } else {
      setPortalView('landing');
    }
  };

  // Phone normalization: keep digits, strip prefix (36, 06, 0036) to leave only local digits (e.g. 301234567)
  const normalizePhone = (phone: string) => {
    let clean = phone.replace(/\D/g, ''); // keep only numbers
    if (clean.startsWith('0036')) clean = clean.substring(4);
    else if (clean.startsWith('36')) clean = clean.substring(2);
    else if (clean.startsWith('06')) clean = clean.substring(2);
    return clean;
  };

  const getCityFromAddress = (addr: string) => {
    const lowerAddr = addr.toLowerCase();
    const matchedCity = Object.values(ZALA_ZIP_MAP).find(c => lowerAddr.includes(c.toLowerCase()));
    if (matchedCity) return matchedCity;
    if (lowerAddr.includes('helyben')) return 'Helyben fogyasztás';
    return 'Egyéb / Kiszállítás';
  };

  const finalizeDailyClose = () => {
    // 1. Gather all today's stats
    const activeDayOrders = db.orders.filter((o: any) => !o.archived);
    const completedOrdersToday = activeDayOrders.filter((o: any) => o.status === 'completed');
    const grossRevenue = completedOrdersToday.reduce((sum: number, o: any) => sum + o.total_amount, 0);
    const netRevenue = Math.round(grossRevenue / 1.27);
    const orderCount = completedOrdersToday.length;

    // Get sold items
    const itemsSoldMap: { [key: string]: number } = {};
    completedOrdersToday.forEach((o: any) => {
      o.items.forEach((item: any) => {
        itemsSoldMap[item.name] = (itemsSoldMap[item.name] || 0) + item.quantity;
      });
    });
    const itemsSold = Object.keys(itemsSoldMap).map(name => ({ name, quantity: itemsSoldMap[name] }));

    // Get sold packaging
    const packagingSoldMap: { [key: string]: number } = {};
    completedOrdersToday.forEach((o: any) => {
      o.items.forEach((item: any) => {
        const menuItem = db.items.find((mi: any) => mi.id === item.item_id);
        const packType = menuItem?.packaging_type || 'none';
        const displayName = packType === 'pizza' ? 'Pizza doboz' : packType === 'box' ? 'Elviteles doboz' : packType === 'cup' ? 'Pohár' : 'Nincs csomagolás';
        packagingSoldMap[displayName] = (packagingSoldMap[displayName] || 0) + item.quantity;
      });
    });
    const packagingSold = Object.keys(packagingSoldMap).map(name => ({ name, quantity: packagingSoldMap[name] }));

    // Get deliveries
    const deliveriesMap: { [key: string]: number } = {};
    completedOrdersToday.forEach((o: any) => {
      const city = getCityFromAddress(o.customer_address);
      deliveriesMap[city] = (deliveriesMap[city] || 0) + 1;
    });
    const deliveries = Object.keys(deliveriesMap).map(city => ({ city, count: deliveriesMap[city] }));

    // Get payments
    const paymentsMap: { [key: string]: number } = {};
    completedOrdersToday.forEach((o: any) => {
      paymentsMap[o.payment_method] = (paymentsMap[o.payment_method] || 0) + o.total_amount;
    });
    const payments = Object.keys(paymentsMap).map(method => ({ method, total: paymentsMap[method] }));

    // Get users performance
    const usersPerformanceMap: { [key: string]: number } = {};
    completedOrdersToday.forEach((o: any) => {
      const user = o.created_by_user || 'Rendszer';
      usersPerformanceMap[user] = (usersPerformanceMap[user] || 0) + 1;
    });
    const usersPerformance = Object.keys(usersPerformanceMap).map(name => ({ name, count: usersPerformanceMap[name] }));

    // Average order gap and idle times
    const sorted = [...completedOrdersToday].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let averageOrderGapMin = 0;
    if (sorted.length > 1) {
      let totalDiffMs = 0;
      for (let i = 1; i < sorted.length; i++) {
        totalDiffMs += new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime();
      }
      averageOrderGapMin = Math.round((totalDiffMs / (sorted.length - 1)) / 60000);
    }

    let maxIdleTimeText = 'N/A';
    if (sorted.length > 1) {
      let maxGapMs = 0;
      let maxStart = '';
      let maxEnd = '';
      for (let i = 1; i < sorted.length; i++) {
        const start = new Date(sorted[i - 1].created_at);
        const end = new Date(sorted[i].created_at);
        const diff = end.getTime() - start.getTime();
        if (diff > maxGapMs) {
          maxGapMs = diff;
          maxStart = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          maxEnd = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
      const gapMin = Math.round(maxGapMs / 60000);
      if (gapMin > 0) {
        maxIdleTimeText = `${maxStart} - ${maxEnd} (${gapMin} perc)`;
      }
    }

    const firstOrderTime = sorted.length > 0 
      ? new Date(sorted[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

    const closeIndex = (db.dailyCloses?.length || 0) + 1;
    
    const newCloseReport = {
      id: closeIndex,
      date: new Date().toLocaleDateString('hu-HU'),
      closeTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      closeIndex,
      grossRevenue,
      netRevenue,
      orderCount,
      startupTime: startupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      firstOrderTime,
      itemsSold,
      packagingSold,
      deliveries,
      payments,
      usersPerformance,
      averageOrderGapMin,
      maxIdleTimeText
    };

    // 2. Archive all current orders (set archived: true)
    const archivedOrders = db.orders.map((o: any) => ({ ...o, archived: true }));

    // 3. Save to database
    const updatedCloses = [...(db.dailyCloses || []), newCloseReport];
    const updatedDb = {
      ...db,
      orders: archivedOrders,
      dailyCloses: updatedCloses
    };

    saveDatabase(updatedDb);

    // 4. Reset states & go back to menu
    setShowDailyCloseModal(false);
    setView('menu');
  };

  const getDeliveryFeeForAddress = async (address: string): Promise<number> => {
    if (!address || address.toLowerCase().includes('helyben') || address.toLowerCase().includes('fogyasztás')) {
      return 0;
    }

    const config = db.deliveryFees || { mode: 'manual', baseFee: 500, perKmFee: 100, settlements: [] };
    const mode = config.mode || 'manual';

    const freeSettlements = config.freeSettlements || [];
    const lowerAddr = address.toLowerCase();
    const isFree = freeSettlements.some((s: any) => 
      (s.zip && lowerAddr.includes(s.zip)) || 
      (s.city && lowerAddr.includes(s.city.toLowerCase()))
    );

    if (isFree) {
      setApiCalculatedDistance(null);
      console.log(`[Delivery Fee] Free delivery match found for address: "${address}"`);
      return 0;
    }

    const getFallbackFee = (addr: string) => {
      const settlements = config.settlements || [];
      const lowerAddr = addr.toLowerCase();
      const match = settlements.find((s: any) => 
        (s.zip && lowerAddr.includes(s.zip)) || 
        (s.city && lowerAddr.includes(s.city.toLowerCase()))
      );
      if (match) {
        if (match.fixedFee !== undefined && match.fixedFee !== null && match.fixedFee !== '') {
          return Number(match.fixedFee);
        }
        if (match.distanceKm !== undefined && match.distanceKm !== null && match.distanceKm !== '') {
          return Math.round(Number(match.distanceKm) * (config.perKmFee || 0) + (config.baseFee || 0));
        }
      }
      return config.baseFee || 0;
    };

    if (mode === 'manual') {
      setApiCalculatedDistance(null);
      return getFallbackFee(address);
    } else if (mode === 'google') {
      const apiKey = config.googleApiKey;
      const origin = config.baseAddress;
      
      if (!apiKey || !origin) {
        setApiCalculatedDistance(null);
        return config.baseFee || 0;
      }

      try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(address)}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const distanceValueMeter = data.rows[0].elements[0].distance.value;
          const distanceKm = distanceValueMeter / 1000.0;
          setApiCalculatedDistance(distanceKm);
          console.log(`[Google Maps API] Distance calculated: ${distanceKm.toFixed(2)} km for destination: ${address}`);
          console.log(`[Google Maps API Route Link]: https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(address)}`);
          
          let calculatedFee = distanceKm * (config.perKmFee || 0) + (config.baseFee || 0);
          
          const rounding = config.rounding || 'exact';
          if (rounding === 'round10') {
            calculatedFee = Math.round(calculatedFee / 10) * 10;
          } else if (rounding === 'round100') {
            calculatedFee = Math.round(calculatedFee / 100) * 100;
          } else {
            calculatedFee = Math.round(calculatedFee);
          }
          return calculatedFee;
        }
      } catch (err) {
        console.error('Google Maps Distance Matrix error:', err);
      }
      
      setApiCalculatedDistance(null);
      return getFallbackFee(address);
    } else if (mode === 'geoapify') {
      const apiKey = config.geoapifyApiKey;
      const origin = config.baseAddress;

      if (!apiKey || !origin) {
        setApiCalculatedDistance(null);
        return config.baseFee || 0;
      }

      try {
        let originCoords = geocodeCache[origin];
        let originFormatted = origin;
        if (!originCoords) {
          const originGeocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(origin)}&filter=countrycode:hu&apiKey=${apiKey}`;
          const originRes = await fetch(originGeocodeUrl);
          const originData = await originRes.json();
          const feature = originData.features?.[0];
          const coords = feature?.geometry?.coordinates; // [lon, lat]
          if (coords) {
            originCoords = [coords[1], coords[0]]; // [lat, lon]
            geocodeCache[origin] = originCoords;
            originFormatted = feature?.properties?.formatted || origin;
          }
        }

        let destCoords = geocodeCache[address];
        let destFormatted = address;
        if (!destCoords) {
          const destGeocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&filter=countrycode:hu&apiKey=${apiKey}`;
          const destRes = await fetch(destGeocodeUrl);
          const destData = await destRes.json();
          const feature = destData.features?.[0];
          const coords = feature?.geometry?.coordinates; // [lon, lat]
          if (coords) {
            destCoords = [coords[1], coords[0]]; // [lat, lon]
            geocodeCache[address] = destCoords;
            destFormatted = feature?.properties?.formatted || address;
          }
        }

        if (originCoords && destCoords) {
          console.log(`[Geoapify Geocoding] Origin: "${origin}" -> Resolved: "${originFormatted}" [${originCoords[0]}, ${originCoords[1]}]`);
          console.log(`[Geoapify Geocoding] Destination: "${address}" -> Resolved: "${destFormatted}" [${destCoords[0]}, ${destCoords[1]}]`);

          const routeUrl = `https://api.geoapify.com/v1/routing?waypoints=${originCoords[0]},${originCoords[1]}|${destCoords[0]},${destCoords[1]}&mode=drive&apiKey=${apiKey}`;
          console.log(`[Geoapify Routing API Query URL]: ${routeUrl}`);

          const routeRes = await fetch(routeUrl);
          const routeData = await routeRes.json();

          if (routeData.features?.[0]?.properties?.distance !== undefined) {
            const distanceValueMeter = routeData.features[0].properties.distance;
            const distanceKm = distanceValueMeter / 1000.0;
            setApiCalculatedDistance(distanceKm);
            console.log(`[Geoapify API] Route Distance: ${distanceKm.toFixed(2)} km`);
            console.log(`[Geoapify Route Visualizer Link on Google Maps]: https://www.google.com/maps/dir/?api=1&origin=${originCoords[0]},${originCoords[1]}&destination=${destCoords[0]},${destCoords[1]}`);
            
            let calculatedFee = distanceKm * (config.perKmFee || 0) + (config.baseFee || 0);
            
            const rounding = config.rounding || 'exact';
            if (rounding === 'round10') {
              calculatedFee = Math.round(calculatedFee / 10) * 10;
            } else if (rounding === 'round100') {
              calculatedFee = Math.round(calculatedFee / 100) * 100;
            } else {
              calculatedFee = Math.round(calculatedFee);
            }
            return calculatedFee;
          }
        }
      } catch (err) {
        console.error('Geoapify Distance Matrix error:', err);
      }

      setApiCalculatedDistance(null);
      return getFallbackFee(address);
    }
    
    setApiCalculatedDistance(null);
    return config.baseFee || 0;
  };

  useEffect(() => {
    getDeliveryFeeForAddress(customerAddress).then(fee => {
      setDeliveryFee(fee);
    });
  }, [customerAddress, db.deliveryFees]);

  const handleZipChange = (zipVal: string) => {
    if (!editingCustomerData) return;
    const city = ZALA_ZIP_MAP[zipVal] || editingCustomerData.city;
    setEditingCustomerData({
      ...editingCustomerData,
      zip: zipVal,
      city
    });
  };

  const handleCityChange = (cityVal: string) => {
    if (!editingCustomerData) return;
    // Find ZIP by city name (case-insensitive)
    const matchedZip = Object.keys(ZALA_ZIP_MAP).find(
      key => ZALA_ZIP_MAP[key].toLowerCase() === cityVal.toLowerCase()
    );
    const zip = matchedZip || editingCustomerData.zip;
    setEditingCustomerData({
      ...editingCustomerData,
      city: cityVal,
      zip
    });
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = db.users.find(
      (u: any) => u.username === loginUsername && u.password === loginPassword
    );
    if (foundUser) {
      setLoginError('');
      setIsLoginFadingOut(true);
      setTimeout(() => {
        setCurrentUser(foundUser);
        setView('menu');
        setIsLoginFadingOut(false);
        if (db.welcomeAnimationEnabled !== false) {
          setIsEntranceAnimating(true);
          setTimeout(() => {
            setIsEntranceAnimating(false);
          }, 1200);
        }
      }, 500);
    } else {
      setLoginError('Hibás felhasználónév vagy jelszó!');
      setLoginFailedShake(true);
      setTimeout(() => {
        setLoginFailedShake(false);
      }, 500);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
    setCart([]);
    setSelectedCategoryId(null);
    setSelectedOrderId(null);
    setLoginUsername('');
    setLoginPassword('');
    setIsCustomerViewActive(false);
    setIsPaymentViewActive(false);
  };

  // Add Item to Cart Immediately (with optional attachment)
  const addToCartImmediately = (item: MenuItem, attachment: MenuItem | null) => {
    setCart(prev => {
      const existing = prev.find(i => 
        i.item_id === item.id && 
        ((!i.custom_modifications?.linked_item && !attachment) || 
         (i.custom_modifications?.linked_item?.item_id === attachment?.id))
      );
      
      const itemPricing = getItemCurrentPricing(item, db.categories);
      const attachmentPricing = attachment ? getItemCurrentPricing(attachment, db.categories) : null;

      const linkedItemVal = attachment && attachmentPricing ? {
        item_id: attachment.id,
        name: attachment.name,
        price_at_order: attachmentPricing.price
      } : null;

      if (existing) {
        return prev.map(i => 
          (i.item_id === item.id && 
           ((!i.custom_modifications?.linked_item && !attachment) || 
            (i.custom_modifications?.linked_item?.item_id === attachment?.id)))
          ? { ...i, quantity: i.quantity + 1 } 
          : i
        );
      }

      // Initialize with default ingredients for this item from MenuItem
      const initialAdjustments: { [key: number]: 'none' | 'normal' | 'double' } = {};
      if (item.ingredients) {
        item.ingredients.forEach((ing: any) => {
          initialAdjustments[ing.ingredientId] = 'normal';
        });
      }

      const calculated_single_price = itemPricing.price + (attachmentPricing ? attachmentPricing.price : 0);
      const category = db.categories.find((c: any) => c.id === item.category_id);
      const includeAttachmentPackFee = category?.include_linked_packaging_fee && attachment;
      const finalPackagingFee = itemPricing.packagingFee + (includeAttachmentPackFee && attachmentPricing ? attachmentPricing.packagingFee : 0);

      return [...prev, {
        item_id: item.id,
        name: item.name,
        quantity: 1,
        price_at_order: itemPricing.price,
        packaging_fee_at_order: finalPackagingFee,
        custom_modifications: {
          portion: 'full',
          ingredient_adjustments: initialAdjustments,
          note: '',
          extra_price: 0,
          calculated_price: calculated_single_price,
          linked_item: linkedItemVal
        }
      }];
    });
  };

  // Add Item to Cart (checks for linked category)
  const addToCart = (item: MenuItem) => {
    const category = db.categories.find((c: any) => c.id === item.category_id);
    if (category && category.linked_category_id !== undefined && category.linked_category_id !== null) {
      setAttachingMenuItem(item);
      setSelectedAttachmentItem(null); // default to none
      return;
    }
    addToCartImmediately(item, null);
  };

  // Helper to open cart item customization modal
  const handleEditCartItemClick = (item: OrderItem) => {
    setEditingCartItem(item);
    setEditQuantity(item.quantity);
    if (item.custom_modifications) {
      setEditPortion(item.custom_modifications.portion);
      setEditIngredientAdjustments({ ...item.custom_modifications.ingredient_adjustments });
      setEditNote(item.custom_modifications.note);
      
      const attachedItem = item.custom_modifications.linked_item 
        ? db.items.find((i: any) => i.id === item.custom_modifications?.linked_item?.item_id) 
        : null;
      setEditLinkedItem(attachedItem || null);
    } else {
      setEditPortion('full');
      setEditNote('');
      setEditLinkedItem(null);
      
      // Initialize with default ingredients for this item from MenuItem
      const menuItem = db.items.find((i: any) => i.id === item.item_id);
      const initialAdjustments: { [key: number]: 'none' | 'normal' | 'double' } = {};
      if (menuItem && menuItem.ingredients) {
        menuItem.ingredients.forEach((ing: any) => {
          initialAdjustments[ing.ingredientId] = 'normal';
        });
      }
      setEditIngredientAdjustments(initialAdjustments);
    }
  };

  // Helper to save customizations of cart item
  const handleSaveCartItemCustomizations = () => {
    if (!editingCartItem) return;

    const baseMenuItem = db.items.find((i: any) => i.id === editingCartItem.item_id);
    const basePrice = baseMenuItem ? baseMenuItem.price : editingCartItem.price_at_order;

    let extra_price = 0;
    Object.keys(editIngredientAdjustments).forEach((key) => {
      const ingId = Number(key);
      const adjustment = editIngredientAdjustments[ingId];
      if (adjustment === 'double') {
        const invItem = db.inventory.find((i: any) => i.id === ingId);
        if (invItem) {
          extra_price += (invItem.double_extra_price || 0);
        }
      }
    });

    const attachmentPrice = editLinkedItem ? editLinkedItem.price : 0;
    const calculated_single_price = Math.round(basePrice * (editPortion === 'half' ? 0.7 : 1.0)) + extra_price + attachmentPrice;

    const category = baseMenuItem ? db.categories.find((c: any) => c.id === baseMenuItem.category_id) : null;
    const includeAttachmentPackFee = category?.include_linked_packaging_fee && editLinkedItem;
    const basePackFee = baseMenuItem ? baseMenuItem.packaging_fee : editingCartItem.packaging_fee_at_order;
    const finalPackagingFee = basePackFee + (includeAttachmentPackFee ? editLinkedItem.packaging_fee : 0);

    const linkedItemVal = editLinkedItem ? {
      item_id: editLinkedItem.id,
      name: editLinkedItem.name,
      price_at_order: editLinkedItem.price
    } : null;

    setCart(prev => prev.map(item => {
      if (item === editingCartItem) {
        return {
          ...item,
          quantity: editQuantity,
          packaging_fee_at_order: finalPackagingFee,
          custom_modifications: {
            portion: editPortion,
            ingredient_adjustments: editIngredientAdjustments,
            note: editNote,
            extra_price: extra_price,
            calculated_price: calculated_single_price,
            linked_item: linkedItemVal
          }
        };
      }
      return item;
    }));

    setEditingCartItem(null);
  };

  // Remove Item from Cart
  const removeFromCart = (itemId: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.item_id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.item_id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.item_id !== itemId);
    });
  };

  // Clear Cart
  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerAddress('');
    setPaymentMethod('Készpénz');
    setDiscountPercentage(0);
    setSelectedCartCustomerId(null);
    setIsPaymentViewActive(false);
  };

  const getReceiptConfigs = (): any[] => {
    if (db.receiptConfigs && Array.isArray(db.receiptConfigs) && db.receiptConfigs.length > 0) {
      return db.receiptConfigs;
    }
    const legacy = db.receiptConfig || {
      name: '1. Példány (Vendég)',
      logoBase64: '',
      logoAlignment: 'center',
      logoPosition: 'top',
      logoScale: 50,
      headerText: 'PRÉMIUM PIZZÉRIA & ÉTTEREM\nTel: +36 30 123 4567\nAdószám: 12345678-2-12',
      footerText: 'Köszönjük a vásárlást!\nEgészségére!\nVárjuk vissza!',
      showOrderId: true,
      showTimestamp: true,
      showPaymentMethod: true,
      showCustomerDetails: true,
      showComment: true,
      showPackagingFee: true,
      showDeliveryFee: true,
      showDiscount: true,
      fontSize: 'medium',
      lineSpacing: 'normal',
      silentPrint: true
    };
    if (!legacy.name) legacy.name = '1. Példány (Vendég)';
    return [legacy];
  };

  const generateReceiptHtml = (order: any, config?: any) => {
    const activeConfig = config || getReceiptConfigs()[0];
    const layout = activeConfig.layoutPreset || 'classic'; // 'classic' | 'delivery' | 'kitchen' | 'minimal'

    const fontSizeMap: Record<string, string> = {
      small: '11px',
      medium: '13px',
      large: '15px'
    };
    const lineSpacingMap: Record<string, string> = {
      tight: '1.1',
      normal: '1.4',
      loose: '1.8'
    };

    const fSize = fontSizeMap[activeConfig.fontSize] || '13px';
    const lSpacing = lineSpacingMap[activeConfig.lineSpacing] || '1.4';

    const dateStr = order.created_at 
      ? new Date(order.created_at).toLocaleString('hu-HU') 
      : new Date().toLocaleString('hu-HU');

    const renderLogoHtml = () => {
      if (!activeConfig.logoBase64 || layout === 'kitchen') return '';
      const alignStyle = activeConfig.logoAlignment === 'center' 
        ? 'margin: 0 auto; display: block;' 
        : activeConfig.logoAlignment === 'right' 
          ? 'margin: 0 0 0 auto; display: block;' 
          : 'margin: 0 auto 0 0; display: block;';
      return `<div style="padding: 6px 0; text-align: ${activeConfig.logoAlignment};">
        <img src="${activeConfig.logoBase64}" style="max-width: ${activeConfig.logoScale}%; height: auto; ${alignStyle}" />
      </div>`;
    };

    const subtotal = order.items.reduce((sum: number, item: any) => {
      const price = item.custom_modifications ? item.custom_modifications.calculated_price : item.price_at_order;
      return sum + price * item.quantity;
    }, 0);
    const packagingTotal = order.items.reduce((sum: number, item: any) => {
      return sum + item.packaging_fee_at_order * item.quantity;
    }, 0);
    const discountAmount = (subtotal + packagingTotal) * ((order.discount_percentage || 0) / 100);

    const renderHeaderBlock = () => {
      if (layout === 'kitchen') return '';
      return `
        ${activeConfig.logoPosition === 'top' ? renderLogoHtml() : ''}
        ${activeConfig.headerText ? `<div class="text-center pre-wrap bold" style="margin-bottom: 8px;">${activeConfig.headerText}</div>` : ''}
        ${activeConfig.logoPosition === 'before_items' ? renderLogoHtml() : ''}
      `;
    };

    const renderMetadataBlock = () => {
      return `
        ${activeConfig.showOrderId ? `<div><span class="bold">Nyugtaszám:</span> #${order.id}</div>` : ''}
        ${activeConfig.showTimestamp ? `<div><span class="bold">Dátum:</span> ${dateStr}</div>` : ''}
        <div><span class="bold">Kiszolgáló:</span> ${order.created_by_user || 'Rendszer'}</div>
      `;
    };

    const renderCustomerBlock = () => {
      if (!activeConfig.showCustomerDetails || !order.customer_address || order.customer_address === 'Helyben fogyasztás') return '';
      
      const isDeliveryFocused = layout === 'delivery';
      return `
        <div style="background: ${isDeliveryFocused ? '#000' : 'transparent'}; color: ${isDeliveryFocused ? '#fff' : '#000'}; padding: ${isDeliveryFocused ? '8px 10px' : '0'}; border: ${isDeliveryFocused ? '3px solid #000' : 'none'}; border-radius: ${isDeliveryFocused ? '6px' : '0'}; margin-bottom: 8px;">
          <div class="bold" style="font-size: ${isDeliveryFocused ? '120%' : '100%'}; text-transform: uppercase;">🚗 Kiszállítási adatok:</div>
          <div style="margin-top: 4px;">Vevő: <span class="bold">${order.customer_name}</span></div>
          <div class="bold" style="font-size: ${isDeliveryFocused ? '135%' : '110%'}; margin-top: 3px; border-bottom: ${isDeliveryFocused ? '1px solid #fff' : 'none'}; padding-bottom: ${isDeliveryFocused ? '4px' : '0'};">${order.customer_address}</div>
          ${activeConfig.showComment && order.split_details?.delivery_instructions ? `
            <div style="font-size: 95%; font-style: italic; margin-top: 4px; font-weight: bold;">Megjegyzés: ${order.split_details.delivery_instructions}</div>
          ` : ''}
        </div>
      `;
    };

    const renderItemsBlock = () => {
      const showPrices = layout !== 'kitchen';
      return `
        <table class="items-table">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th align="left" class="bold">Tétel</th>
              <th align="center" class="bold" style="width: 15%;">Db</th>
              ${showPrices ? '<th align="right" class="bold" style="width: 30%;">Érték</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item: any) => {
              const price = item.custom_modifications ? item.custom_modifications.calculated_price : item.price_at_order;
              const name = item.custom_modifications?.is_menu_order 
                ? `${item.name || item.item_name} (Menü)`
                : (item.name || item.item_name);
              
              let subnotes: string[] = [];
              if (item.custom_modifications) {
                const mods = item.custom_modifications;
                if (mods.portion === 'half') {
                  subnotes.push('⚠️ FÉL ADAG');
                }
                
                if (mods.selected_courses) {
                  const courseNames = mods.selected_courses.map((c: any) => c.itemName).join(', ');
                  subnotes.push(`🍲 MENÜ VÁLASZTÁS: ${courseNames.toUpperCase()}`);
                }

                if (mods.ingredient_adjustments) {
                  Object.entries(mods.ingredient_adjustments).forEach(([ingIdStr, status]) => {
                    const ingId = parseInt(ingIdStr);
                    const ingredient = db.inventory.find((i: any) => i.id === ingId);
                    if (ingredient) {
                      if (status === 'none') {
                        subnotes.push(`❌ NÉLKÜL: ${ingredient.name.toUpperCase()}`);
                      } else if (status === 'double') {
                        subnotes.push(`➕ DUPLA: ${ingredient.name.toUpperCase()}`);
                      }
                    }
                  });
                }

                if (mods.note && mods.note.trim()) {
                  subnotes.push(`💬 MEGJEGYZÉS: ${mods.note.trim().toUpperCase()}`);
                }
              }
              
              return `
                <tr>
                  <td>
                    <div style="font-weight: bold; font-size: ${layout === 'kitchen' ? '115%' : '100%'};">${name}</div>
                    ${subnotes.length > 0 ? `
                      <div style="font-size: 85%; padding-left: 6px; margin-top: 3px; font-weight: bold; border-left: 2px solid #000; line-height: 1.2;">
                        ${subnotes.map(note => `<div style="margin-top: 1px;">${note}</div>`).join('')}
                      </div>
                    ` : ''}
                  </td>
                  <td align="center" style="font-size: ${layout === 'kitchen' ? '120%' : '100%'}; font-weight: bold;">${item.quantity}</td>
                  ${showPrices ? `<td align="right">${(price * item.quantity).toLocaleString()} Ft</td>` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    };

    const renderTotalsBlock = () => {
      if (layout === 'kitchen') return '';
      const paymentSuffix = activeConfig.showPaymentMethod ? ` (${order.payment_method})` : '';
      return `
        <table style="width: 100%;">
          <tr>
            <td>Részösszeg:</td>
            <td align="right">${subtotal.toLocaleString()} Ft</td>
          </tr>
          ${activeConfig.showPackagingFee && packagingTotal > 0 ? `
            <tr>
              <td>Csomagolási díj:</td>
              <td align="right">${packagingTotal.toLocaleString()} Ft</td>
            </tr>
          ` : ''}
          ${activeConfig.showDeliveryFee && order.delivery_fee > 0 ? `
            <tr>
              <td>Szállítási díj:</td>
              <td align="right">${order.delivery_fee.toLocaleString()} Ft</td>
            </tr>
          ` : ''}
          ${activeConfig.showDiscount && discountAmount > 0 ? `
            <tr style="color: #000;">
              <td>Kedvezmény (${order.discount_percentage}%):</td>
              <td align="right">-${Math.round(discountAmount).toLocaleString()} Ft</td>
            </tr>
          ` : ''}
          <tr class="total-row">
            <td style="padding-top: 6px;">ÖSSZESEN${paymentSuffix}:</td>
            <td align="right" style="padding-top: 6px;">${order.total_amount.toLocaleString()} Ft</td>
          </tr>
        </table>
      `;
    };

    const renderFooterBlock = () => {
      if (layout === 'kitchen') return '';
      return `
        ${activeConfig.logoPosition === 'bottom' ? renderLogoHtml() : ''}
        ${activeConfig.footerText ? `<div class="text-center pre-wrap bold" style="margin-top: 8px;">${activeConfig.footerText}</div>` : ''}
      `;
    };

    let innerBodyHtml = '';
    if (layout === 'delivery') {
      innerBodyHtml = `
        ${renderCustomerBlock()}
        <div class="divider"></div>
        ${renderHeaderBlock()}
        ${renderMetadataBlock()}
        <div class="divider"></div>
        ${renderItemsBlock()}
        <div class="divider"></div>
        ${renderTotalsBlock()}
        <div class="double-divider"></div>
        ${renderFooterBlock()}
      `;
    } else if (layout === 'kitchen') {
      innerBodyHtml = `
        <div class="text-center bold" style="font-size: 130%; border: 3px solid #000; padding: 6px; margin-bottom: 8px; text-transform: uppercase;">⚠️ KONYHAI BLOKK ⚠️</div>
        ${renderMetadataBlock()}
        ${renderCustomerBlock()}
        <div class="divider"></div>
        ${renderItemsBlock()}
        <div class="double-divider"></div>
      `;
    } else {
      // 'classic' or 'minimal'
      innerBodyHtml = `
        ${renderHeaderBlock()}
        <div class="divider"></div>
        ${renderMetadataBlock()}
        <div class="divider"></div>
        ${renderItemsBlock()}
        <div class="divider"></div>
        ${renderTotalsBlock()}
        ${renderCustomerBlock()}
        <div class="double-divider"></div>
        ${renderFooterBlock()}
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 68mm;
            margin: 0;
            padding: 4mm 4mm 4mm 2mm;
            font-size: ${fSize};
            line-height: ${lSpacing};
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-top: 2px double #000; margin: 8px 0; }
          .items-table { width: 100%; border-collapse: collapse; }
          .items-table th, .items-table td { padding: 4px 0; vertical-align: top; }
          .pre-wrap { white-space: pre-wrap; font-family: inherit; margin: 0; }
          .total-row { font-size: calc(${fSize} + 2px); font-weight: bold; }
        </style>
      </head>
      <body>
        ${innerBodyHtml}
      </body>
      </html>
    `;
  };

  const printOrderReceipt = (order: any) => {
    const configs = getReceiptConfigs();
    configs.forEach((cfg) => {
      const html = generateReceiptHtml(order, cfg);
      const isSilent = cfg.silentPrint !== false;
      if (window.electronAPI?.printReceipt) {
        window.electronAPI.printReceipt(html, db.selectedPrinter, isSilent)
          .then((res: any) => {
            if (res && !res.success) {
              console.error(`Nyomtatási hiba (${cfg.name}):`, res.error);
              alert(`Sikertelen nyomtatás (${cfg.name}): ` + res.error);
            }
          })
          .catch((err: any) => {
            console.error(`Nyomtatási hiba (${cfg.name}):`, err);
          });
      } else {
        console.log(`Nyomtatási feladat szimuláció (${cfg.name}):`, db.selectedPrinter);
        console.log(html);
      }
    });
  };

  // Submit Order
  const submitOrder = () => {
    if (cart.length === 0) return;

    const config = db.deliveryFees || { mode: 'manual', baseFee: 500, perKmFee: 100, settlements: [] };
    const minOrderAmount = config.minOrderAmount || 0;
    const isDelivery = !!(customerAddress && !customerAddress.toLowerCase().includes('helyben') && !customerAddress.toLowerCase().includes('fogyasztás'));

    const subtotal = cart.reduce((sum, item) => {
      const price = item.custom_modifications ? item.custom_modifications.calculated_price : item.price_at_order;
      return sum + (price + item.packaging_fee_at_order) * item.quantity;
    }, 0);
    const discountAmount = subtotal * (discountPercentage / 100);
    const finalAmount = Math.max(0, Math.round(subtotal - discountAmount) + deliveryFee);

    if (isDelivery && minOrderAmount > 0) {
      const itemsTotal = cart.reduce((sum, item) => {
        const price = item.custom_modifications ? item.custom_modifications.calculated_price : item.price_at_order;
        return sum + price * item.quantity;
      }, 0);
      const packagingTotal = cart.reduce((sum, item) => {
        return sum + item.packaging_fee_at_order * item.quantity;
      }, 0);
      const discountVal = (itemsTotal + packagingTotal) * (discountPercentage / 100);

      let minSumToCheck = itemsTotal;
      if (!config.excludePackaging) {
        minSumToCheck += packagingTotal;
      }
      if (!config.excludeDelivery) {
        minSumToCheck += deliveryFee;
      }
      if (!config.excludeDiscount) {
        minSumToCheck -= discountVal;
      }

      if (minSumToCheck < minOrderAmount) {
        alert(`A rendelés nem éri el a minimális összeget! Kiszállítási minimum: ${minOrderAmount.toLocaleString()} FT (Beszámított összeg: ${Math.round(minSumToCheck).toLocaleString()} FT)`);
        return;
      }
    }

    const newOrder: Order = {
      id: db.orders.length > 0 ? Math.max(...db.orders.map((o: any) => o.id)) + 1 : 1,
      customer_id: selectedCartCustomerId,
      customer_name: customerName || 'Névtelen Ügyfél',
      customer_address: customerAddress || 'Helyben fogyasztás',
      payment_method: paymentMethod,
      discount_percentage: discountPercentage,
      total_amount: finalAmount,
      status: db.enableStaffPortals !== false ? 'pending' : 'completed',
      created_at: new Date().toISOString(),
      items: [...cart],
      split_details: paymentMethod === 'Bontott fizetés' ? { splitGroups, splitAssignments } : null,
      created_by_user: currentUser?.name || 'Rendszer',
      delivery_fee: deliveryFee
    };

    // Deduct stock if inventory matches
    const updatedInventory = db.inventory.map((inv: any) => {
      let quantityToDeduct = 0;
      cart.forEach(cartItem => {
        if (cartItem.custom_modifications?.is_menu_order && cartItem.custom_modifications.selected_courses) {
          cartItem.custom_modifications.selected_courses.forEach(choice => {
            if (choice.itemId && choice.ingredients) {
              const ingMatch = choice.ingredients.find(ing => ing.ingredientId === inv.id);
              if (ingMatch) {
                quantityToDeduct += cartItem.quantity * ingMatch.quantity;
              }
            }
          });
        } else {
          const menuItem = db.items.find((i: any) => i.id === cartItem.item_id);
          if (menuItem && menuItem.ingredients) {
            const ingMatch = menuItem.ingredients.find((ing: any) => ing.ingredientId === inv.id);
            if (ingMatch) {
              let factor = 1;
              if (cartItem.custom_modifications?.portion === 'half') {
                factor = 0.5;
              }
              const adj = cartItem.custom_modifications?.ingredient_adjustments?.[inv.id];
              if (adj === 'none') {
                factor = 0;
              } else if (adj === 'double') {
                factor *= 2;
              }
              quantityToDeduct += cartItem.quantity * ingMatch.quantity * factor;
            }
          }
          if (menuItem && (!menuItem.ingredients || menuItem.ingredients.length === 0)) {
            if (menuItem.category_id === 1 && inv.id <= 3) { // Pizza ingredients
              quantityToDeduct += cartItem.quantity * 1;
            }
            if (menuItem.category_id === 2 && inv.id === 6) { // Pasta
              quantityToDeduct += cartItem.quantity * 1;
            }
          }
        }
      });
      return {
        ...inv,
        quantity: Math.max(0, inv.quantity - quantityToDeduct)
      };
    });

    const updatedDb = {
      ...db,
      orders: [...db.orders, newOrder],
      inventory: updatedInventory
    };

    saveDatabase(updatedDb);
    if (db.autoPrintOnOrder !== false) {
      printOrderReceipt(newOrder);
    }
    clearCart();
  };

  // Complete Order
  const completeOrder = (orderId: number) => {
    const updatedOrders = db.orders.map((o: any) => {
      if (o.id === orderId) {
        return { ...o, status: 'completed' as const };
      }
      return o;
    });

    saveDatabase({
      ...db,
      orders: updatedOrders
    });

    if (selectedOrderId === orderId) {
      setSelectedOrderId(null);
    }
  };

  // Delete/Cancel active order
  const cancelOrder = (orderId: number) => {
    const updatedOrders = db.orders.filter((o: any) => o.id !== orderId);
    saveDatabase({
      ...db,
      orders: updatedOrders
    });
    if (selectedOrderId === orderId) {
      setSelectedOrderId(null);
    }
  };

  // Active Orders (status is pending)
  const activeOrders = db.orders.filter((o: any) => o.status === 'pending' && !o.archived);

  // Completed Orders (History)
  const completedOrders = db.orders.filter((o: any) => o.status === 'completed' && !o.archived);

  // All completed orders (for overall history)
  const allCompletedOrders = db.orders.filter((o: any) => o.status === 'completed');

  // Statistics Calculation
  const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + o.total_amount, 0);
  const pendingRevenue = activeOrders.reduce((sum: number, o: any) => sum + o.total_amount, 0);
  
  // Chart Data: Daily Revenue
  const getRevenueChartData = () => {
    const revenueMap: { [key: string]: number } = {};
    completedOrders.forEach((o: any) => {
      const date = new Date(o.created_at).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' });
      revenueMap[date] = (revenueMap[date] || 0) + o.total_amount;
    });
    // Fallback if empty
    if (Object.keys(revenueMap).length === 0) {
      return [
        { date: '07.02', bevetel: 45000 },
        { date: '07.03', bevetel: 62000 },
        { date: '07.04', bevetel: 58000 },
        { date: '07.05', bevetel: 89000 },
        { date: '07.06', bevetel: totalRevenue || 75000 }
      ];
    }
    return Object.keys(revenueMap).map(date => ({
      date,
      bevetel: revenueMap[date]
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  // Chart Data: Sales by Category
  const getCategoryChartData = () => {
    const categoryMap: { [key: string]: number } = {};
    completedOrders.forEach((o: any) => {
      o.items.forEach((item: any) => {
        const menuItem = db.items.find((i: any) => i.id === item.item_id);
        const category = db.categories.find((c: any) => c.id === menuItem?.category_id);
        if (category) {
          categoryMap[category.name] = (categoryMap[category.name] || 0) + item.quantity;
        }
      });
    });
    if (Object.keys(categoryMap).length === 0) {
      return [
        { name: 'Pizzák', value: 45 },
        { name: 'Tészták', value: 20 },
        { name: 'Frissensültek', value: 15 },
        { name: 'Italok', value: 30 }
      ];
    }
    const COLORS = ['#0071e3', '#30d158', '#ff9f0a', '#ff453a', '#af52de', '#5ac8fa'];
    return Object.keys(categoryMap).map((name, index) => ({
      name,
      value: categoryMap[name],
      color: COLORS[index % COLORS.length]
    }));
  };

  // Chart Data: Inventory Level vs Warning Limit
  const getInventoryChartData = () => {
    return db.inventory.map((inv: any) => ({
      nev: inv.name,
      mennyiseg: inv.quantity,
      limit: inv.warning_limit
    }));
  };

  // Regex Chatbot Engine
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const newMsg: ChatMessage = {
      id: chatMessages.length + 1,
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');

    // Process Bot Response
    setTimeout(() => {
      const botResponseText = parseBotResponse(userText);
      const botMsg: ChatMessage = {
        id: chatMessages.length + 2,
        sender: 'bot',
        text: botResponseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, botMsg]);
    }, 600);
  };

  const parseBotResponse = (text: string): string => {
    const textLower = text.toLowerCase();

    // 1. CHATBOT ORDER PARSING: "15. pizza extra sajttal, paradicsom alap helyet tejfölös alappal Budapest 6. került Széchenyi tér 6ra bankkártyás fizetéssel"
    // Let's check for keywords like address "budapest", "kerület", "utca", "tér" or number + "pizza"
    if (textLower.includes('budapest') || textLower.includes('kerület') || textLower.includes('fizetéssel') || textLower.includes('címre') || textLower.includes('rendelés')) {
      // Find quantity (e.g. "15. pizza" -> 15 Pizzas or Pizza ID 15)
      // Standard Hungarian: "15. pizza" -> Pizza number 15 (if they mean Margherita/Sonkas etc.).
      // "15 db pizza" -> 15 Margherita pizzas.
      // Let's support both: if they say "15. pizza" we will interpret it as adding 15 Margherita Pizzas to the cart (since 15 pizzas is a large order, or Margherita is our default pizza),
      // and parse notes: "extra sajttal, paradicsom alap helyett tejfölös alappal"
      let qty = 1;
      const qtyMatch = textLower.match(/(\d+)\s*(db|x|\.)?\s*pizza/);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1]);
      }

      // Parse payment method
      let payMethod: 'Készpénz' | 'Bankkártya' | 'SZÉP Kártya' = 'Készpénz';
      if (textLower.includes('bankkártya') || textLower.includes('kártyás')) {
        payMethod = 'Bankkártya';
      } else if (textLower.includes('szép kártya')) {
        payMethod = 'SZÉP Kártya';
      }

      // Parse Address
      let address = 'Budapest';
      const addressMatch = text.match(/(Budapest[^\,]+(?:kerület|került)?[^\,]+(?:tér|utca|út|köz)?[^\,]*?\d+ra|Budapest.*?\d+)/i);
      if (addressMatch) {
        address = addressMatch[1].replace(/ra$/, '').replace(/re$/, '').trim();
      } else {
        // Fallback: search for "Széchenyi" etc.
        const stMatch = text.match(/(Budapest.*?\d+)/i);
        if (stMatch) address = stMatch[1];
      }

      // Find pizza item in db
      const pizzaItem = db.items.find((i: any) => i.category_id === 1) || { id: 1, name: 'Margherita Pizza', price: 1890, packaging_fee: 150 };

      // Parse modifications/notes
      let notes = '';
      if (textLower.includes('extra')) {
        const notesMatch = text.match(/extra.*?(alap.*?alappal|sajttal)/i);
        if (notesMatch) notes = ` (${notesMatch[0]})`;
      }

      // Let's create this order directly in the database!
      const finalPrice = (pizzaItem.price + pizzaItem.packaging_fee) * qty;
      const chatbotOrder: Order = {
        id: db.orders.length > 0 ? Math.max(...db.orders.map((o: any) => o.id)) + 1 : 1,
        customer_name: 'Chatbot Megrendelő',
        customer_address: address,
        payment_method: payMethod,
        discount_percentage: 0,
        total_amount: finalPrice,
        status: 'pending',
        created_at: new Date().toISOString(),
        items: [
          {
            item_id: pizzaItem.id,
            name: `${pizzaItem.name}${notes}`,
            quantity: qty,
            price_at_order: pizzaItem.price,
            packaging_fee_at_order: pizzaItem.packaging_fee
          }
        ],
        created_by_user: 'Chatbot Asszisztens'
      };

      const updatedDb = {
        ...db,
        orders: [...db.orders, chatbotOrder]
      };
      saveDatabase(updatedDb);

      return `🍕 **Rendelés sikeresen rögzítve!** \n\n` + 
             `• **Étel:** ${qty}x ${pizzaItem.name}${notes}\n` +
             `• **Cím:** ${address}\n` +
             `• **Fizetés:** ${payMethod}\n` +
             `• **Végösszeg:** ${finalPrice.toLocaleString()} FT\n\n` +
             `A rendelés azonnal megjelent a bal oldali bent lévő rendelések listájában.`;
    }

    // 2. ADMIN COMMAND: Add new item
    // "vigyél fel a Pizza kategóriába egy 18. pizzát Sonkás pizza néven 1800FT-ért"
    if (currentUser?.role === 'admin' && (textLower.includes('vigyél fel') || textLower.includes('hozz létre') || textLower.includes('adj hozzá')) && (textLower.includes('kategória') || textLower.includes('kategóriába'))) {
      // Find category
      let categoryId = 1; // Default Pizzák
      const catMatch = db.categories.find((c: any) => textLower.includes(c.name.toLowerCase().replace(/ák$/, 'a').replace(/ok$/, 'o')));
      if (catMatch) categoryId = catMatch.id;

      // Match name
      let itemName = 'Új Étel';
      const nameMatch = text.match(/(?:néven|neve)\s+([^0-9]+?)(?:\s+\d+|\s+áron|\s+ért|$)/i);
      if (nameMatch) {
        itemName = nameMatch[1].trim();
      } else {
        // Fallback name search between quotes or keywords
        const quoteMatch = text.match(/"([^"]+)"|'([^']+)'/);
        if (quoteMatch) itemName = quoteMatch[1] || quoteMatch[2];
      }

      // Match price
      let itemPrice = 1800;
      const priceMatch = text.match(/(\d+)\s*(?:FT|forint)/i);
      if (priceMatch) {
        itemPrice = parseInt(priceMatch[1]);
      }

      const newItem: MenuItem = {
        id: db.items.length > 0 ? Math.max(...db.items.map((i: any) => i.id)) + 1 : 1,
        category_id: categoryId,
        name: itemName,
        price: itemPrice,
        packaging_fee: 150
      };

      const updatedDb = {
        ...db,
        items: [...db.items, newItem]
      };
      saveDatabase(updatedDb);

      return `✅ **Új étel rögzítve!**\n\n` +
             `• **Név:** ${itemName}\n` +
             `• **Kategória:** ${db.categories.find((c: any) => c.id === categoryId)?.name}\n` +
             `• **Ár:** ${itemPrice.toLocaleString()} FT\n` +
             `• **Csomagolási díj:** 150 FT`;
    }

    // 3. ADMIN COMMAND: Increase prices by percentage
    // "a pizza kategóriában lévő összes ételcikknek az árát 15%-al növeld"
    if (currentUser?.role === 'admin' && (textLower.includes('növeld') || textLower.includes('emeld') || textLower.includes('változtasd')) && textLower.includes('%')) {
      // Find category
      const pizzaCat = db.categories.find((c: any) => textLower.includes(c.name.toLowerCase().replace(/ák$/, 'a').replace(/ok$/, 'o')));
      if (!pizzaCat) return `❌ Nem találtam ilyen nevű kategóriát a rendszerben. Kérlek írd le pontosan a kategória nevét!`;

      // Find percentage
      const pctMatch = textLower.match(/(\d+)\s*%/);
      if (!pctMatch) return `❌ Nem tudtam kiolvasni a százalékos értéket a parancsból. (pl: "15%-al növeld")`;
      const percentage = parseInt(pctMatch[1]);

      const updatedItems = db.items.map((item: any) => {
        if (item.category_id === pizzaCat.id) {
          return {
            ...item,
            price: Math.round(item.price * (1 + percentage / 100))
          };
        }
        return item;
      });

      const updatedDb = {
        ...db,
        items: updatedItems
      };
      saveDatabase(updatedDb);

      return `📈 **Árak sikeresen frissítve!**\n\nA(z) **${pizzaCat.name}** kategóriába tartozó összes étel ára **${percentage}%**-al növekedett.`;
    }

    // 4. USER INSTRUCTION / HELP QUESTIONS
    if (textLower.includes('bejelentkezés') || textLower.includes('belépni') || textLower.includes('jelszó')) {
      return `🔑 **Bejelentkezéshez használható adatok:**\n\n` +
             `• **Felhasználónév:** \`admin\` | **Jelszó:** \`admin\` (Rendszergazda)\n` +
             `• **Felhasználónév:** \`user\` | **Jelszó:** \`user\` (Kiszolgáló)\n\n` +
             `Írd be a belépési képernyőn a megfelelő adatokat az eléréshez!`;
    }

    if (textLower.includes('statisztika') || textLower.includes('kimutatás') || textLower.includes('adminisztráció')) {
      return `📊 **Statisztikák elérése:**\n\n` +
             `Jelentkezz be **admin** jogosultsággal, majd kattints a jobb felső sarokban található **Fogaskerék** ikonra. ` +
             `Itt a Statisztikák fül alatt láthatod a napi bevételeket, legnépszerűbb kategóriákat és raktárkészlet riasztásokat.`;
    }

    if (textLower.includes('rendelés') || textLower.includes('hogyan kell') || textLower.includes('kosár')) {
      return `🛒 **Rendelés felvételének lépései:**\n\n` +
             `1. Válaszd ki a kategóriát a főképernyő közepén.\n` +
             `2. Kattints a kívánt ételcikk kártyájára a kosárba helyezéshez.\n` +
             `3. A jobb oldali **Kosár** sávban adhatod meg az **Ügyfél adatait**, a **Fizetési módot** és a **Kedvezményt**.\n` +
             `4. Kattints a **Rendelés beküldése** gombra.\n\n` +
             `Ha van aktív rendelés, az a bal oldali sávban azonnal megjelenik.`;
    }

    // Fallback response
    return `🤖 **Sajnálom, de csak a program használatával, az étlappal és a rendelésekkel kapcsolatos kérdésekre tudok válaszolni.** \n\n` +
           `Próbálj meg ilyen jellegű kérdéseket feltenni, vagy adj ki egy rendelési parancsot (pl.: *Sonkás Pizza rendelése Budapest Széchenyi tér 6ra bankkártyával*).`;
  };

  const [tick, setTick] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Background check for expired cook timers
  useEffect(() => {
    let changed = false;
    const updatedOrders = (db.orders || []).map((o: any) => {
      if (o.status === 'pending' && o.preparation_status === 'preparing' && o.cook_timer_started_at && o.cook_timer_minutes) {
        const started = new Date(o.cook_timer_started_at).getTime();
        const remaining = (o.cook_timer_minutes * 60 * 1000) - (Date.now() - started);
        if (remaining <= 0) {
          changed = true;
          return {
            ...o,
            preparation_status: 'ready_for_delivery'
          };
        }
      }
      return o;
    });
    if (changed) {
      saveDatabase({ ...db, orders: updatedOrders });
    }
  }, [tick, db.orders]);

  const getRemainingTime = (order: Order) => {
    if (!order.cook_timer_minutes || !order.cook_timer_started_at) return null;
    const started = new Date(order.cook_timer_started_at).getTime();
    const duration = order.cook_timer_minutes * 60 * 1000;
    const elapsed = Date.now() - started;
    const remaining = duration - elapsed;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  };

  const renderPortal = (isStandalone: boolean) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayShifts = (db.shifts || []).filter((s: any) => s.date === todayStr);
    const todayCouriers = todayShifts
      .filter((s: any) => s.roles.includes('Futár'))
      .map((s: any) => db.users.find((u: any) => u.id === s.userId))
      .filter(Boolean);

    return (
      <div style={{
        width: isStandalone ? '100%' : '45%',
        minWidth: isStandalone ? 'auto' : '420px',
        maxWidth: isStandalone ? 'none' : '650px',
        height: '100%',
        background: '#09090a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {!isStandalone && (
          <div style={{
            background: '#1c1c1e',
            borderBottom: '1px solid var(--glass-border)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            userSelect: 'none'
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }}></div>
            </div>
            <div style={{
              flex: 1,
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.7)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'monospace'
            }}>
              <span style={{ color: 'var(--success)' }}>🔒</span>
              <span>munkatars.sdordersystem.hu</span>
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {!portalUser ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              background: 'radial-gradient(circle at top, rgba(191,90,242,0.05), transparent)'
            }}>
              <div style={{
                width: '100%',
                maxWidth: '340px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '24px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #bf5af2, #5e5ce6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto',
                    boxShadow: '0 0 15px rgba(191,90,242,0.4)'
                  }}>
                    <Activity size={24} color="white" />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0 }}>Munkatársi Portál</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Konyha és Futár felület bejelentkezés</span>
                </div>

                <form onSubmit={handlePortalLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {portalLoginError && (
                    <div style={{
                      padding: '8px 12px',
                      background: 'rgba(255,69,58,0.1)',
                      border: '1px solid rgba(255,69,58,0.2)',
                      borderRadius: '6px',
                      color: '#ff453a',
                      fontSize: '11px',
                      fontWeight: 500
                    }}>
                      ⚠️ {portalLoginError}
                    </div>
                  )}
                  <div>
                    <label className="input-label">Felhasználónév</label>
                    <input
                      type="text"
                      className="input-field"
                      value={portalLoginUsername}
                      onChange={e => setPortalLoginUsername(e.target.value)}
                      placeholder="pl: futar1"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Jelszó</label>
                    <input
                      type="password"
                      className="input-field"
                      value={portalLoginPassword}
                      onChange={e => setPortalLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '6px', width: '100%' }}>
                    Bejelentkezés
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid var(--glass-border)',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: portalUser.color || 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 10px ${portalUser.color}44`
                  }}>
                    {renderUserIcon(portalUser.symbol || 'User', 16, 'white')}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{portalUser.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {portalView === 'kitchen' ? '👨‍🍳 Szakács Felület' : portalView === 'courier' ? '🚗 Futár Felület' : 'Kezdőlap'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {portalUser.web_roles && portalUser.web_roles.length > 1 && (
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px' }}>
                      {portalUser.web_roles.includes('Szakács') && (
                        <button
                          onClick={() => setPortalView('kitchen')}
                          style={{
                            background: portalView === 'kitchen' ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: portalView === 'kitchen' ? 'white' : 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Konyha
                        </button>
                      )}
                      {portalUser.web_roles.includes('Futár') && (
                        <button
                          onClick={() => setPortalView('courier')}
                          style={{
                            background: portalView === 'courier' ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: portalView === 'courier' ? 'white' : 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Futár
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    className="btn"
                    style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(255,69,58,0.15)', color: '#ff453a', border: '1px solid rgba(255,69,58,0.2)' }}
                    onClick={() => {
                      setActiveSessions(prev => prev.filter(s => s.userId !== portalUser.id));
                      setPortalUser(null);
                      setPortalView('landing');
                    }}
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
                {portalView === 'landing' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px', alignItems: 'center' }}>
                    <h4 style={{ color: 'white', margin: 0, fontSize: '15px', fontWeight: 600 }}>Válassz felületet a munkához:</h4>
                    {portalUser.web_roles?.includes('Szakács') && (
                      <button
                        className="btn btn-primary"
                        style={{ width: '220px', padding: '14px', background: 'linear-gradient(135deg, #ff9f0a, #ff7b00)', border: 'none', borderRadius: '10px', fontSize: '13px' }}
                        onClick={() => setPortalView('kitchen')}
                      >
                        👨‍🍳 Konyha / Szakács felület
                      </button>
                    )}
                    {portalUser.web_roles?.includes('Futár') && (
                      <button
                        className="btn btn-primary"
                        style={{ width: '220px', padding: '14px', background: 'linear-gradient(135deg, #0a84ff, #0055ff)', border: 'none', borderRadius: '10px', fontSize: '13px' }}
                        onClick={() => setPortalView('courier')}
                      >
                        🚗 Kiszállítás / Futár felület
                      </button>
                    )}
                  </div>
                )}

                {portalView === 'kitchen' && (() => {
                  const preparingOrders = (db.orders || []).filter(
                    (o: Order) => o.status === 'pending' && (!o.preparation_status || o.preparation_status === 'preparing')
                  );

                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>Aktív konyhai rendelések ({preparingOrders.length})</span>
                      </div>

                      <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                        gap: '16px',
                        padding: '4px',
                        alignContent: 'start'
                      }}>
                        {preparingOrders.map((order: Order) => {
                          const remaining = getRemainingTime(order) ?? 0;
                          const isPreparing = order.preparation_status === 'preparing';

                          return (
                            <div
                              key={order.id}
                              onClick={() => {
                                setPortalOrderDetailsId(order.id);
                                setPortalCookTimerMins(order.cook_timer_minutes || 20);
                                setPortalCookCourierId(order.assigned_courier_id || null);
                              }}
                              style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: isPreparing ? '2px solid #ff9f0a' : '2px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                position: 'relative',
                                boxShadow: isPreparing ? '0 4px 15px rgba(255,159,10,0.1)' : '0 4px 12px rgba(0,0,0,0.2)'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 850, color: 'white', fontSize: '15px' }}>Rendelés #{order.id}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{order.created_at.split('T')[1].substring(0, 5)}</span>
                              </div>
                              
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: 'white', fontWeight: 600 }}>
                                  <span>👤</span>
                                  <span>{order.customer_name}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <span>📍</span>
                                  <span style={{ wordBreak: 'break-word' }}>{order.customer_address}</span>
                                </div>
                              </div>

                              <div style={{
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                paddingTop: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}>
                                {order.items.map((i: OrderItem, idx: number) => {
                                  const hasModifications = i.custom_modifications && (
                                    i.custom_modifications.portion === 'half' ||
                                    i.custom_modifications.linked_item ||
                                    i.custom_modifications.note ||
                                    Object.values(i.custom_modifications.ingredient_adjustments || {}).some(adj => adj === 'double' || adj === 'none')
                                  );

                                  return (
                                    <div 
                                      key={idx} 
                                      style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        background: hasModifications ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                                        border: hasModifications ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid transparent',
                                        borderRadius: '8px',
                                        padding: hasModifications ? '10px' : '4px 6px'
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'white' }}>{i.quantity}x {i.name}</span>
                                        {hasModifications && (
                                          <span style={{ fontSize: '9px', background: 'rgba(191,90,242,0.2)', border: '1px solid #bf5af2', color: '#bf5af2', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                            MÓDOSÍTOTT
                                          </span>
                                        )}
                                      </div>
                                      {renderKitchenItemModifications(i, db.inventory)}
                                    </div>
                                  );
                                })}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginTop: 'auto' }}>
                                {isPreparing ? (
                                  <span style={{
                                    fontSize: '11px',
                                    color: remaining === 0 ? '#ff453a' : '#ff9f0a',
                                    fontWeight: 800,
                                    background: remaining === 0 ? 'rgba(255,69,58,0.15)' : 'rgba(255,159,10,0.15)',
                                    border: remaining === 0 ? '1px solid rgba(255,69,58,0.3)' : '1px solid rgba(255,159,10,0.3)',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    ⏳ {remaining === 0 ? 'LEJÁRT' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} hátra`}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    🍳 Előkészítésre vár
                                  </span>
                                )}

                                {order.assigned_courier_id ? (() => {
                                  const courier = db.users.find((u: any) => u.id === order.assigned_courier_id);
                                  return courier ? (
                                    <span style={{
                                      fontSize: '11px',
                                      color: 'white',
                                      background: courier.color || 'var(--primary)',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      {renderUserIcon(courier.symbol || 'User', 12, 'white')} {courier.name}
                                    </span>
                                  ) : null;
                                })() : (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>Nincs futár</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {preparingOrders.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            👨‍🍳 Nincs aktív rendelés a konyhában. Minden kész!
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {portalView === 'courier' && (() => {
                  const courierOrders = (db.orders || []).filter((o: Order) => {
                    if (o.status !== 'pending') return false;
                    
                    if (portalCourierFilter === 'all_progress') {
                      return !o.preparation_status || o.preparation_status === 'preparing';
                    } else if (portalCourierFilter === 'all_delivery') {
                      return o.preparation_status === 'ready_for_delivery';
                    } else if (portalCourierFilter === 'my_orders') {
                      return portalUser !== null && o.assigned_courier_id === portalUser.id;
                    }
                    return true;
                  });

                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{
                        display: 'flex',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        padding: '2px',
                        marginBottom: '14px'
                      }}>
                        <button
                          onClick={() => setPortalCourierFilter('all_progress')}
                          style={{
                            flex: 1,
                            background: portalCourierFilter === 'all_progress' ? '#1c1c1e' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 4px',
                            color: portalCourierFilter === 'all_progress' ? 'white' : 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Folyamatban (Konyha)
                        </button>
                        <button
                          onClick={() => setPortalCourierFilter('all_delivery')}
                          style={{
                            flex: 1,
                            background: portalCourierFilter === 'all_delivery' ? '#1c1c1e' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 4px',
                            color: portalCourierFilter === 'all_delivery' ? 'white' : 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Kiszállításra Kész
                        </button>
                        <button
                          onClick={() => setPortalCourierFilter('my_orders')}
                          style={{
                            flex: 1,
                            background: portalCourierFilter === 'my_orders' ? '#1c1c1e' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 4px',
                            color: portalCourierFilter === 'my_orders' ? 'white' : 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Saját ({db.orders.filter((o: Order) => o.status === 'pending' && portalUser && o.assigned_courier_id === portalUser.id).length})
                        </button>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                        {courierOrders.map((order: Order) => {
                          const isPreparing = order.preparation_status === 'preparing';
                          const remaining = getRemainingTime(order);
                          
                          let borderStyle = '1px solid var(--glass-border)';
                          if (order.assigned_courier_id) {
                            const courier = db.users.find((u: any) => u.id === order.assigned_courier_id);
                            if (courier) {
                              borderStyle = `2px solid ${courier.color || 'var(--primary)'}`;
                            }
                          }

                          return (
                            <div
                              key={order.id}
                              onClick={() => {
                                setPortalOrderDetailsId(order.id);
                                setPortalCookCourierId(order.assigned_courier_id || null);
                              }}
                              style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: borderStyle,
                                borderRadius: '8px',
                                padding: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontWeight: 700, color: 'white', fontSize: '12px' }}>Rendelés #{order.id}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{order.created_at.split('T')[1].substring(0, 5)}</span>
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
                                📍 {order.customer_name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                {order.customer_address}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#30d158' }}>
                                  {order.total_amount.toLocaleString()} FT ({order.payment_method})
                                </span>
                                
                                {isPreparing ? (
                                  <span style={{
                                    fontSize: '9px',
                                    color: '#ff9f0a',
                                    background: 'rgba(255,159,10,0.1)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700
                                  }}>
                                    ⏳ Készül ({remaining !== null ? `${Math.floor(remaining / 60)}p` : 'folyamatban'})
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: '9px',
                                    color: '#30d158',
                                    background: 'rgba(48,209,88,0.1)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700
                                  }}>
                                    🚗 Kiszállításra kész
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {courierOrders.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            🚗 Nincsenek ilyen rendelések.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {portalOrderDetailsId && (() => {
          const order = db.orders.find((o: any) => o.id === portalOrderDetailsId);
          if (!order) return null;
          const isPreparing = order.preparation_status === 'preparing';

          return (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              zIndex: 9999
            }}>
              <div style={{
                width: '100%',
                maxWidth: '360px',
                background: '#1c1c1e',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                  <h4 style={{ margin: 0, color: 'white', fontSize: '14px', fontWeight: 700 }}>Rendelés #{order.id} Részletei</h4>
                  <button
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => setPortalOrderDetailsId(null)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <div style={{ color: 'white', fontWeight: 600 }}>Címzett: {order.customer_name}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Cím: {order.customer_address}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Fizetés: {order.total_amount.toLocaleString()} FT ({order.payment_method})</div>
                </div>

                 <div style={{
                   background: 'rgba(255,255,255,0.02)',
                   border: '1px solid rgba(255,255,255,0.04)',
                   borderRadius: '8px',
                   padding: '8px',
                   maxHeight: '260px',
                   overflowY: 'auto',
                   display: 'flex',
                   flexDirection: 'column',
                   gap: '8px'
                 }}>
                   {order.items.map((i: OrderItem, idx: number) => {
                     const hasModifications = i.custom_modifications && (
                       i.custom_modifications.portion === 'half' ||
                       i.custom_modifications.linked_item ||
                       i.custom_modifications.note ||
                       Object.values(i.custom_modifications.ingredient_adjustments || {}).some(adj => adj === 'double' || adj === 'none')
                     );

                     return (
                       <div 
                         key={idx} 
                         style={{ 
                           display: 'flex', 
                           flexDirection: 'column',
                           background: hasModifications ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                           border: hasModifications ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid transparent',
                           borderRadius: '6px',
                           padding: hasModifications ? '8px' : '4px 6px'
                         }}
                       >
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ fontWeight: 700, fontSize: '13px', color: 'white' }}>{i.quantity}x {i.name}</span>
                           {hasModifications && (
                             <span style={{ fontSize: '8px', background: 'rgba(191,90,242,0.2)', border: '1px solid #bf5af2', color: '#bf5af2', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                               MÓDOSÍTOTT
                             </span>
                           )}
                         </div>
                         {renderKitchenItemModifications(i, db.inventory)}
                       </div>
                     );
                   })}
                 </div>

                {portalView === 'kitchen' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                    <div>
                      <label className="input-label" style={{ fontSize: '10px' }}>Elkészülési idő (perc)</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        {[10, 15, 20, 30].map(m => (
                          <button
                            key={m}
                            onClick={() => setPortalCookTimerMins(m)}
                            style={{
                              flex: 1,
                              padding: '4px',
                              borderRadius: '4px',
                              border: portalCookTimerMins === m ? '1px solid #ff9f0a' : '1px solid rgba(255,255,255,0.08)',
                              background: portalCookTimerMins === m ? 'rgba(255,159,10,0.15)' : 'transparent',
                              color: portalCookTimerMins === m ? '#ff9f0a' : 'var(--text-secondary)',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {m}p
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        className="input-field"
                        style={{ marginTop: '6px', padding: '4px 8px', fontSize: '11px', height: '28px' }}
                        value={portalCookTimerMins}
                        onChange={e => setPortalCookTimerMins(Math.max(1, parseInt(e.target.value) || 20))}
                        placeholder="Egyedi percek..."
                      />
                    </div>

                    <div>
                      <label className="input-label" style={{ fontSize: '10px' }}>Futár hozzárendelése</label>
                      <select
                        className="input-field"
                        style={{ background: '#1c1c1e', color: 'white', marginTop: '4px', padding: '4px 8px', fontSize: '11px', height: '28px' }}
                        value={portalCookCourierId || ''}
                        onChange={e => setPortalCookCourierId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">-- Nincs futár kijelölve --</option>
                        {todayCouriers.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <button
                        className="btn"
                        style={{ flex: 1, fontSize: '11px', padding: '8px' }}
                        onClick={() => {
                          const updatedOrders = db.orders.map((o: any) => o.id === order.id ? {
                            ...o,
                            preparation_status: 'preparing',
                            cook_timer_minutes: portalCookTimerMins,
                            cook_timer_started_at: new Date().toISOString(),
                            assigned_courier_id: portalCookCourierId
                          } : o);
                          saveDatabase({ ...db, orders: updatedOrders });
                          setPortalOrderDetailsId(null);
                        }}
                      >
                        Főzés Indítása
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: '11px', padding: '8px', background: '#ff9f0a', border: 'none' }}
                        onClick={() => {
                          const updatedOrders = db.orders.map((o: any) => o.id === order.id ? {
                            ...o,
                            preparation_status: 'ready_for_delivery',
                            assigned_courier_id: portalCookCourierId
                          } : o);
                          saveDatabase({ ...db, orders: updatedOrders });
                          setPortalOrderDetailsId(null);
                        }}
                      >
                        Kész (Szállításra)
                      </button>
                    </div>
                  </div>
                )}

                {portalView === 'courier' && (() => {
                  const canReassign = db.couriersCanReassign === true;
                  const isAssignedToMe = portalUser !== null && order.assigned_courier_id === portalUser.id;
                  const isUnassigned = !order.assigned_courier_id;
                  const allowChange = canReassign || isUnassigned;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                      <div>
                        <label className="input-label" style={{ fontSize: '10px' }}>Kézbesítő Futár</label>
                        {allowChange ? (
                          <select
                            className="input-field"
                            style={{ background: '#1c1c1e', color: 'white', marginTop: '4px', padding: '4px 8px', fontSize: '11px', height: '28px' }}
                            value={portalCookCourierId || ''}
                            onChange={e => {
                              const val = e.target.value ? Number(e.target.value) : null;
                              setPortalCookCourierId(val);
                              const updatedOrders = db.orders.map((o: any) => o.id === order.id ? {
                                ...o,
                                assigned_courier_id: val
                              } : o);
                              saveDatabase({ ...db, orders: updatedOrders });
                            }}
                          >
                            <option value="">-- Nincs futár kijelölve --</option>
                            {todayCouriers.map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div style={{
                            marginTop: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'white',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '6px 10px',
                            borderRadius: '4px'
                          }}>
                            🔒 {(() => {
                              const courier = db.users.find((u: any) => u.id === order.assigned_courier_id);
                              return courier ? courier.name : 'Nincs';
                            })()}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        {isUnassigned && (
                          <button
                            className="btn btn-primary"
                            style={{ flex: 1, fontSize: '11px', padding: '8px', background: '#0a84ff', border: 'none' }}
                            onClick={() => {
                              const updatedOrders = db.orders.map((o: any) => o.id === order.id ? {
                                ...o,
                                assigned_courier_id: portalUser?.id
                              } : o);
                              saveDatabase({ ...db, orders: updatedOrders });
                              setPortalOrderDetailsId(null);
                            }}
                          >
                            Magamhoz rendelés
                          </button>
                        )}

                        {!isPreparing && (isAssignedToMe || canReassign) && (
                          <button
                            className="btn btn-primary"
                            style={{ flex: 1, fontSize: '11px', padding: '8px', background: '#30d158', border: 'none' }}
                            onClick={() => {
                              const updatedOrders = db.orders.map((o: any) => o.id === order.id ? {
                                ...o,
                                status: 'completed',
                                preparation_status: 'delivered'
                              } : o);
                              saveDatabase({ ...db, orders: updatedOrders });
                              setPortalOrderDetailsId(null);
                            }}
                          >
                            Kézbesítve (Kész)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // Rendering Views
  if (!window.electronAPI) {
    return (
      <div className="app-container" style={{ background: '#09090a', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderPortal(true)}
      </div>
    );
  }

  return (
    <div className={`app-container ${isEntranceAnimating ? 'entrance-animating' : ''}`}>
      {/* Top Navigation Bar */}
      <nav className="top-navbar">
        <div className="navbar-left">
          {currentUser && (
            <>
              <button className="btn" onClick={() => { setShowTodayOrdersModal(true); setSelectedDetailOrderId(null); }}>
                <History size={16} />
                Előzmények
              </button>
              <button 
                className="btn" 
                onClick={() => {
                  setShowRaktarFeltoltesModal(true);
                  if (db.suppliers && db.suppliers.length > 0) {
                    setFeltoltesSupplierId(db.suppliers[0].id);
                  } else {
                    setFeltoltesSupplierId('');
                  }
                  setFeltoltesInvoiceNum('');
                  setFeltoltesMode('manual');
                  setFeltoltesItemsList([]);
                  setFeltoltesSearchQuery('');
                  setFeltoltesSelectedItem(null);
                  setFeltoltesAddQty(0);
                  setAnalysisSuccess(false);
                  setIsAnalyzingInvoice(false);
                  setFeltoltesUploadedFileName(null);
                  setShowFeltoltesSuccessCard(false);
                  setAnalysisProgress(0);
                  setAnalysisStep('');
                }}
              >
                <Package size={16} />
                Raktár feltöltés
              </button>
            </>
          )}
        </div>
        <div className="navbar-center">
          Ételrendelő program
        </div>
        <div className="navbar-right">
          {currentUser && (
            <>
              <button 
                className="napi-zaras-btn"
                onClick={() => setShowDailyCloseModal(true)}
                style={{ marginRight: '10px' }}
              >
                <Clock size={14} /> Napi Zárás
              </button>
              {currentUser.role === 'admin' && (
                <button 
                  className={`btn btn-icon ${view === 'admin' ? 'btn-primary' : ''}`}
                  onClick={() => setView(view === 'admin' ? 'menu' : 'admin')}
                  title="Admin beállítások"
                >
                  <Settings size={20} />
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="navbar-user-info">
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{currentUser.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {currentUser.role === 'admin' ? 'Adminisztrátor' : 'Kiszolgáló'}
                  </div>
                </div>
                <button className="btn btn-icon" onClick={handleLogout} title="Kijelentkezés">
                  <LogOut size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Main Content View Switcher */}
      <main className="main-content" style={{ display: 'flex', width: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        
        {/* Left Side: Main Application */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          height: '100%', 
          overflow: 'hidden'
        }}>
        
        {/* LOGIN VIEW */}
        {view === 'login' && (() => {
          const matchedLoginUser = db.users?.find(
            (u: any) => u.username.trim().toLowerCase() === loginUsername.trim().toLowerCase()
          );
          const isCredentialsCorrect = db.users?.some(
            (u: any) => u.username.trim().toLowerCase() === loginUsername.trim().toLowerCase() &&
                        u.password?.trim().toLowerCase() === loginPassword.trim().toLowerCase()
          );
          return (
            <div 
              ref={loginContainerRef}
              className="login-view"
              onMouseMove={(e) => {
                const rect = loginContainerRef.current?.getBoundingClientRect();
                if (rect) {
                  setMousePos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                  });
                }
              }}
            >
              {/* Animated Background Orbs */}
              <div className="login-bg-glow">
                <div className="login-orb login-orb-1" />
                <div className="login-orb login-orb-2" />
                <div className="login-orb login-orb-3" />
              </div>

              {/* Elastic Cursor Rope */}
              <svg 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 15,
                  opacity: isLoginFadingOut ? 0 : 1,
                  transition: 'opacity 0.4s ease'
                }}
              >
                <defs>
                  <linearGradient 
                    id="ropeGrad" 
                    x1={mousePos.x} 
                    y1={mousePos.y} 
                    x2={targetPos.x} 
                    y2={targetPos.y}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#0071e3" stopOpacity="0.95" />
                    <stop offset="50%" stopColor="#bf5af2" stopOpacity="0.6" />
                    <stop offset="85%" stopColor="#ff453a" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#ff453a" stopOpacity="0" />
                  </linearGradient>
                  <filter id="ropeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Glow layer */}
                <path 
                  d={`M ${mousePos.x} ${mousePos.y} Q ${ropeCtrl.x} ${ropeCtrl.y} ${targetPos.x} ${targetPos.y}`}
                  fill="none"
                  stroke="url(#ropeGrad)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.3"
                  filter="url(#ropeGlow)"
                />
                {/* Main line */}
                <path 
                  d={`M ${mousePos.x} ${mousePos.y} Q ${ropeCtrl.x} ${ropeCtrl.y} ${targetPos.x} ${targetPos.y}`}
                  fill="none"
                  stroke="url(#ropeGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              <div className={`login-card ${loginFailedShake ? 'login-card-shake' : ''} ${isLoginFadingOut ? 'login-card-fadeout' : ''} ${isCredentialsCorrect ? 'success-liquid' : ''}`}>
                {showGreenRipple && <div className="login-green-ripple" />}
                
                {isCredentialsCorrect && (
                  <div className="login-liquid-container">
                    <div className="login-liquid-blob blob-1" />
                    <div className="login-liquid-blob blob-2" />
                    <div className="login-liquid-blob blob-3" />
                  </div>
                )}

                <div className="login-header" style={{ position: 'relative', zIndex: 2 }}>
                  <div 
                    className="login-logo-orb"
                    style={{ 
                      background: matchedLoginUser?.color 
                        ? `linear-gradient(135deg, ${matchedLoginUser.color} 0%, rgba(255,255,255,0.06) 100%)` 
                        : undefined,
                      borderColor: matchedLoginUser?.color ? matchedLoginUser.color : undefined
                    }}
                  >
                    {matchedLoginUser ? (
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>
                        {matchedLoginUser.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <div className="logo-inner-dot" />
                    )}
                  </div>
                  <h2 className="login-logo">Bejelentkezés</h2>
                  <p className="login-subtitle">Ételrendelő és Kezelő Rendszer</p>
                  
                  {matchedLoginUser && (
                    <div style={{
                      marginTop: '10px',
                      fontSize: '12px',
                      color: '#30d158',
                      fontWeight: 600,
                      background: 'rgba(48, 209, 88, 0.08)',
                      border: '1px solid rgba(48, 209, 88, 0.15)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      animation: 'appleEntrance 0.3s ease-out'
                    }}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#30d158', animation: 'pulseDot 1s infinite alternate' }} />
                      Felismerve: {matchedLoginUser.name}
                    </div>
                  )}
                </div>
                <form className="login-form" onSubmit={handleLogin} style={{ position: 'relative', zIndex: 2 }}>
                  {loginError && <div className="login-error-badge">{loginError}</div>}
                  
                  <div>
                    <label className="input-label">Felhasználónév</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '12px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <User size={16} />
                      </span>
                      <input 
                        ref={usernameInputRef}
                        type="text" 
                        className="input-field" 
                        value={loginUsername} 
                        onChange={e => {
                          setLoginUsername(e.target.value);
                          if (loginError) setLoginError('');
                        }} 
                        placeholder="pl: admin"
                        required 
                        style={{
                          paddingLeft: '38px',
                          borderColor: loginError ? 'var(--danger)' : undefined,
                          width: '100%'
                        }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '14px' }}>
                    <label className="input-label">Jelszó</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '12px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <Lock size={16} />
                      </span>
                      <input 
                        ref={passwordInputRef}
                        type="password" 
                        className="input-field" 
                        value={loginPassword} 
                        onChange={e => {
                          setLoginPassword(e.target.value);
                          if (loginError) setLoginError('');
                        }} 
                        placeholder="••••••••"
                        required 
                        style={{
                          paddingLeft: '38px',
                          borderColor: loginError ? 'var(--danger)' : undefined,
                          width: '100%'
                        }}
                      />
                    </div>
                  </div>
                  
                  <button 
                    ref={submitButtonRef}
                    type="submit" 
                    className={`btn-login-submit ${
                      loginError 
                        ? 'error' 
                        : (!loginUsername.trim() || !loginPassword.trim()) 
                          ? 'disabled' 
                          : 'active'
                    }`}
                    disabled={!loginUsername.trim() || !loginPassword.trim()}
                  >
                    Belépés
                  </button>
                </form>
              </div>
            </div>
          );
        })()}

        {/* ORDER / MAIN MENU VIEW */}
        {view === 'menu' && (
          <div className="order-view">
            
            {/* Left Sidebar: Active Orders (Visible only if there are active orders and staff portals are enabled) */}
            {db.enableStaffPortals !== false && activeOrders.length > 0 && (
              <aside className="side-panel">
                <div className="panel-header">
                  <span className="panel-title">
                    <ShoppingBag size={18} color="var(--primary)" />
                    Bent lévő rendelések ({activeOrders.length})
                  </span>
                </div>
                <div className="panel-content">
                  <div className="active-orders-list">
                    {activeOrders.map((order: Order) => (
                      <div 
                        key={order.id} 
                        className={`order-card ${selectedOrderId === order.id ? 'selected' : ''}`}
                        onClick={() => setSelectedOrderId(order.id === selectedOrderId ? null : order.id)}
                      >
                        <div className="order-card-header">
                          <span className="order-id">#{order.id} rendelés</span>
                          <span className={`order-status ${order.status}`}>
                            {order.status === 'pending' ? 'Folyamatban' : 'Teljesítve'}
                          </span>
                        </div>
                        <div className="order-card-body">
                          <strong>{order.customer_name}</strong><br />
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {order.customer_address}
                          </span>
                          <div style={{ marginTop: '6px', fontSize: '11px' }}>
                            {order.items.map((i, idx) => (
                              <div key={idx} style={{ marginBottom: '2px' }}>
                                <strong>{i.quantity}x {i.name}</strong>
                                {renderKitchenItemModifications(i, db.inventory)}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="order-card-footer">
                          <span>{order.total_amount.toLocaleString()} FT</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              className="btn btn-success" 
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                completeOrder(order.id);
                              }}
                            >
                              Kész
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelOrder(order.id);
                              }}
                            >
                              Töröl
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            )}

            {/* Center Area: Menu Grid or Customer Search Panel */}
            <section className="menu-area">
              {isCustomerViewActive ? (
                <div className="customer-panel">
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                    <h2 className="menu-section-title" style={{ border: 'none', padding: 0, margin: 0 }}>
                      <User size={22} color="var(--primary)" />
                      Ügyfelek Keresése & Kezelése
                    </h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-primary"
                        onClick={() => {
                          setIsCreatingNewCustomer(true);
                          setSelectedCustomerIdForEdit('NEW');
                          setEditingCustomerData({
                            id: `CUST-${db.customers.length > 0 ? Math.max(...db.customers.map((c: any) => parseInt(c.id.split('-')[1]) || 1000)) + 1 : 1001}`,
                            name: '',
                            phone_prefix: '+36',
                            phone_number: '',
                            zip: '',
                            city: '',
                            street: '',
                            house_number: '',
                            details: '',
                            points: 0,
                            is_problematic: false
                          });
                        }}
                      >
                        <Plus size={16} /> Új ügyfél
                      </button>
                      <button className="btn" onClick={() => setIsCustomerViewActive(false)}>
                        Vissza az étlapra
                      </button>
                    </div>
                  </div>

                  {/* Main Grid: two columns if editor is open, otherwise full width */}
                  <div className="customer-panel-layout" style={{ display: 'grid', gridTemplateColumns: editingCustomerData ? '360px 1fr' : '1fr', gap: '20px', marginTop: '10px' }}>
                    
                    {/* Left Column: Search & List */}
                    <div className="customer-left-col" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label className="input-label" style={{ marginBottom: '4px', fontSize: '12px' }}>Keresés</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Írd be a nevet, számot, címet vagy azonosítót..."
                            value={customerSearchQuery} 
                            onChange={e => setCustomerSearchQuery(e.target.value)} 
                            style={{ paddingLeft: '40px', height: '36px', fontSize: '13px' }}
                          />
                          <Search size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        </div>
                      </div>

                      <div className="customer-list-scroll">
                        {db.customers.filter((c: any) => {
                          const query = customerSearchQuery.trim().toLowerCase();
                          if (!query) return true;

                          if (c.id.toLowerCase().includes(query)) return true;
                          if (c.name.toLowerCase().includes(query)) return true;
                          const addr = `${c.zip} ${c.city} ${c.street} ${c.house_number} ${c.details}`.toLowerCase();
                          if (addr.includes(query)) return true;

                          const queryDigits = query.replace(/\D/g, '');
                          if (queryDigits) {
                            const qNorm = normalizePhone(query);
                            const cNorm = normalizePhone(c.phone_number);
                            if (cNorm.includes(qNorm)) return true;
                          }

                          return false;
                        }).map((c: any) => (
                          <div 
                            key={c.id} 
                            className={`customer-list-item ${selectedCustomerIdForEdit === c.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedCustomerIdForEdit(c.id);
                              setEditingCustomerData({ ...c });
                              setIsCreatingNewCustomer(false);
                            }}
                            style={{ padding: '8px 12px', marginBottom: '6px' }}
                          >
                            <div>
                              <strong style={{ color: c.is_problematic ? 'var(--danger)' : 'var(--text-main)', fontSize: '13px' }}>
                                {c.name || 'anonim'} 
                                {c.is_problematic && ' ⚠️'}
                              </strong>
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {c.phone_prefix} {c.phone_number}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {c.city}
                              </span>
                              <span className="customer-badge" style={{ fontSize: '10px', padding: '1px 4px' }}>{c.id}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: Detailed Editor (Visible only if editingCustomerData is active) */}
                    {editingCustomerData && (
                      <div className="customer-right-col">
                        <div className="customer-editor-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px' }}>
                              {isCreatingNewCustomer ? 'Új ügyfél adatlapja' : `Szerkesztés: ${editingCustomerData.id}`}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Pontok: <strong>{editingCustomerData.points}</strong>
                              </span>
                              <div 
                                className={`problematic-btn ${editingCustomerData.is_problematic ? 'active' : ''}`}
                                onClick={() => setEditingCustomerData({ ...editingCustomerData, is_problematic: !editingCustomerData.is_problematic })}
                                style={{ width: '32px', height: '32px' }}
                                title="Problémás vendég megjelölés"
                              >
                                <AlertTriangle size={14} />
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
                              <div>
                                <label className="input-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Név</label>
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  style={{ height: '34px', fontSize: '13px' }}
                                  value={editingCustomerData.name} 
                                  onChange={e => setEditingCustomerData({ ...editingCustomerData, name: e.target.value })}
                                  placeholder="pl: Nagy Lajos"
                                />
                              </div>
                              <div>
                                <label className="input-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Telefonszám</label>
                                <div className="phone-input-row" style={{ gridTemplateColumns: '110px 1fr', gap: '6px' }}>
                                  <AppleSelect
                                    value={editingCustomerData.phone_prefix}
                                    onChange={val => setEditingCustomerData({ ...editingCustomerData, phone_prefix: String(val) })}
                                    options={[
                                      { value: '+36', label: '+36 (HU)' },
                                      { value: '+43', label: '+43 (AT)' },
                                      { value: '+40', label: '+40 (RO)' },
                                      { value: '+421', label: '+421 (SK)' }
                                    ]}
                                    icon={<Phone size={12} />}
                                    isOpen={openPrefixDropdown}
                                    onToggle={() => setOpenPrefixDropdown(!openPrefixDropdown)}
                                    onClose={() => setOpenPrefixDropdown(false)}
                                  />
                                  <input 
                                    type="text" 
                                    className="input-field"
                                    style={{ height: '34px', fontSize: '13px' }}
                                    value={editingCustomerData.phone_number}
                                    onChange={e => setEditingCustomerData({ ...editingCustomerData, phone_number: e.target.value.replace(/\D/g, '') })}
                                    placeholder="Számok"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="address-sub-grid" style={{ gap: '10px' }}>
                              <div>
                                <label className="input-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Irányítószám</label>
                                <input 
                                  type="text" 
                                  className="input-field"
                                  style={{ height: '34px', fontSize: '13px' }}
                                  value={editingCustomerData.zip}
                                  onChange={e => handleZipChange(e.target.value)}
                                  placeholder="pl: 8900"
                                />
                              </div>
                              <div>
                                <label className="input-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Település</label>
                                <input 
                                  type="text" 
                                  className="input-field"
                                  style={{ height: '34px', fontSize: '13px' }}
                                  value={editingCustomerData.city}
                                  onChange={e => handleCityChange(e.target.value)}
                                  placeholder="pl: Zalaegerszeg"
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                              <div>
                                <label className="input-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Utca</label>
                                <input 
                                  type="text" 
                                  className="input-field"
                                  style={{ height: '34px', fontSize: '13px' }}
                                  value={editingCustomerData.street}
                                  onChange={e => setEditingCustomerData({ ...editingCustomerData, street: e.target.value })}
                                  placeholder="pl: Kossuth Lajos utca"
                                />
                              </div>
                              <div>
                                <label className="input-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Házszám</label>
                                <input 
                                  type="text" 
                                  className="input-field"
                                  style={{ height: '34px', fontSize: '13px' }}
                                  value={editingCustomerData.house_number}
                                  onChange={e => setEditingCustomerData({ ...editingCustomerData, house_number: e.target.value })}
                                  placeholder="pl: 12."
                                />
                              </div>
                            </div>

                            <div>
                              <label className="input-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Megjegyzés</label>
                              <input 
                                type="text" 
                                className="input-field"
                                style={{ height: '34px', fontSize: '13px' }}
                                value={editingCustomerData.details}
                                onChange={e => setEditingCustomerData({ ...editingCustomerData, details: e.target.value })}
                                placeholder="pl: kapucsengő 4"
                              />
                            </div>

                          </div>

                          {/* Action buttons always at the bottom of editor, no scroll */}
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
                            <button 
                              className="btn" 
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => {
                                setSelectedCustomerIdForEdit(null);
                                setEditingCustomerData(null);
                                setIsCreatingNewCustomer(false);
                                setSelectedCartCustomerId(null);
                                setCustomerName('');
                                setCustomerAddress('');
                              }}
                            >
                              Mégse
                            </button>
                            <button 
                              className="btn btn-success"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => {
                                const savedName = editingCustomerData.name.trim() || 'anonim';
                                const savedCustomer = {
                                  ...editingCustomerData,
                                  name: savedName
                                };

                                let updatedCustomers = [...db.customers];
                                if (isCreatingNewCustomer) {
                                  updatedCustomers.push(savedCustomer);
                                } else {
                                  updatedCustomers = db.customers.map((c: any) => c.id === editingCustomerData.id ? savedCustomer : c);
                                }

                                const updatedDb = {
                                  ...db,
                                  customers: updatedCustomers
                                };

                                saveDatabase(updatedDb);

                                setSelectedCartCustomerId(savedCustomer.id);
                                setCustomerName(savedCustomer.name);
                                setCustomerAddress(`${savedCustomer.zip} ${savedCustomer.city}, ${savedCustomer.street} ${savedCustomer.house_number} ${savedCustomer.details ? `(${savedCustomer.details})` : ''}`.trim());
                                
                                // Auto-fill last used payment method if available
                                const customerOrders = db.orders.filter((o: any) => o.customer_id === savedCustomer.id);
                                if (customerOrders.length > 0) {
                                  const sorted = [...customerOrders].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                  const lastPay = sorted[0].payment_method;
                                  if (lastPay && lastPay !== 'Bontott fizetés') {
                                    setPaymentMethod(lastPay as any);
                                  }
                                }
                                
                                setSelectedCustomerIdForEdit(null);
                                setEditingCustomerData(null);
                                setIsCreatingNewCustomer(false);
                                setIsCustomerViewActive(false);
                              }}
                            >
                              Kiválasztom
                            </button>
                          </div>

                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ) : selectedCategoryId === null ? (
                // Categories view
                <>
                  <h2 className="menu-section-title">
                    <Layers size={22} color="var(--primary)" />
                    Étlap Kategóriák
                  </h2>
                  <div className="cards-grid" key="categories-view">
                    {db.categories.filter((cat: Category) => isCategoryVisible(cat)).map((cat: Category) => (
                      <div 
                        key={cat.id} 
                        className="category-card"
                        onClick={() => {
                          if (cat.is_menu_category) {
                            setWizardCategory(cat);
                            setWizardCourseIndex(0);
                            setWizardChoices([]);
                            setShowMenuWizardModal(true);
                          } else {
                            setSelectedCategoryId(cat.id);
                          }
                        }}
                      >
                        <span className="category-name">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                // Food Items view
                <>
                  <h2 className="menu-section-title">
                    <button className="btn menu-back-btn" onClick={() => setSelectedCategoryId(null)}>
                      <ChevronLeft size={14} />
                      Vissza
                    </button>
                    {db.categories.find((c: any) => c.id === selectedCategoryId)?.name}
                  </h2>
                  <div className="cards-grid" key={`items-view-${selectedCategoryId}`}>
                    {db.items
                      .filter((item: MenuItem) => item.category_id === selectedCategoryId && item.is_active !== false)
                      .map((item: MenuItem) => {
                        const pricing = getItemCurrentPricing(item, db.categories);
                        const stockStatus = getDishStockStatus(item, db.inventory);

                        let cardStyle: React.CSSProperties = {};
                        if (stockStatus.status === 'out_of_stock') {
                          cardStyle = {
                            border: '2px solid #ff453a',
                            boxShadow: '0 0 12px rgba(255, 69, 58, 0.25)',
                            opacity: 0.65,
                            cursor: 'not-allowed'
                          };
                        } else if (stockStatus.status === 'warning') {
                          cardStyle = {
                            border: '2px solid #ff9f0a',
                            boxShadow: '0 0 12px rgba(255, 159, 10, 0.2)'
                          };
                        }

                        return (
                          <div 
                            key={item.id} 
                            className="item-card"
                            style={cardStyle}
                            onClick={() => {
                              if (stockStatus.status === 'out_of_stock') {
                                alert(`Nem rendelhető: A(z) "${item.name}" ételhez szükséges "${stockStatus.oosIngredient}" alapanyag teljesen elfogyott!`);
                                return;
                              }
                              addToCart(item);
                            }}
                          >
                            <span className="item-name">{item.name}</span>
                            <div className="item-details">
                              {pricing.price !== item.price ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '11px', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                                    {item.price.toLocaleString()} FT
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="item-price" style={{ color: pricing.price < item.price ? 'var(--success)' : '#ff9f0a', fontWeight: 700 }}>
                                      {pricing.price.toLocaleString()} FT
                                    </span>
                                    <span style={{
                                      fontSize: '9px',
                                      background: pricing.price < item.price ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 159, 10, 0.15)',
                                      color: pricing.price < item.price ? '#30d158' : '#ff9f0a',
                                      padding: '2px 4px',
                                      borderRadius: '4px',
                                      fontWeight: 600
                                    }}>
                                      {pricing.price < item.price ? 'AKCIÓ' : 'FELÁR'}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="item-price">{item.price.toLocaleString()} FT</span>
                              )}
                              <span className="item-pack-fee">
                                Csomagolás: {pricing.packagingFee > 0 ? `${pricing.packagingFee} FT` : 'ingyenes'}
                              </span>
                              {stockStatus.status === 'out_of_stock' && (
                                <span style={{ fontSize: '10px', color: '#ff453a', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                                  ❌ ELFOGYOTT ({stockStatus.oosIngredient})
                                </span>
                              )}
                              {stockStatus.status === 'warning' && (
                                <span style={{ fontSize: '10px', color: '#ff9f0a', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                                  ⚠️ ALACSONY KÉSZLET
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                </>
              )}
            </section>

            {/* Right Sidebar: Cart */}
            <aside className="side-panel right">
              <div className="panel-header">
                <span className="panel-title">
                  <ShoppingCart size={18} color="var(--primary)" />
                  Kosár
                </span>
                {cart.length > 0 && (
                  <button className="btn" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={clearCart}>
                    Ürítés
                  </button>
                )}
              </div>
              
              <div className="panel-content">
                {cart.length === 0 ? (
                  <div className="cart-empty">
                    <ShoppingCart size={32} />
                    <span>A kosár még üres</span>
                  </div>
                ) : (
                  <div className="cart-items">
                    {cart.map((item: OrderItem) => {
                      const itemPrice = item.custom_modifications ? item.custom_modifications.calculated_price : item.price_at_order;
                      const isMenu = !!item.custom_modifications?.is_menu_order;
                      return (
                        <div 
                          key={item.item_id} 
                          className="cart-item" 
                          style={{ cursor: isMenu ? 'default' : 'pointer' }}
                          onClick={() => {
                            if (!isMenu) {
                              handleEditCartItemClick(item);
                            }
                          }}
                        >
                          <div className="cart-item-info">
                            <span className="cart-item-qty">{item.quantity}x</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="cart-item-name" title={item.name}>{item.name}</span>
                              {item.custom_modifications && (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px' }}>
                                  {isMenu && item.custom_modifications.selected_courses && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px', paddingLeft: '6px', borderLeft: '2px solid var(--primary)' }}>
                                      {item.custom_modifications.selected_courses.map((choice, cidx) => (
                                        <span key={cidx} style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                          {choice.courseName}: <strong>{choice.itemName}</strong>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {!isMenu && item.custom_modifications.portion === 'half' && (
                                    <span style={{ color: '#ff9f0a' }}>🔸 Fél adag (70%)</span>
                                  )}
                                  {!isMenu && Object.keys(item.custom_modifications.ingredient_adjustments).map(key => {
                                    const ingId = Number(key);
                                    const adj = item.custom_modifications!.ingredient_adjustments[ingId];
                                    if (adj === 'normal') return null;
                                    const invItem = db.inventory.find((i: any) => i.id === ingId);
                                    if (!invItem) return null;
                                    return (
                                      <span key={ingId} style={{ color: adj === 'double' ? '#30d158' : '#ff453a' }}>
                                        {adj === 'double' ? `+ Dupla ${invItem.name}` : `- Kihagyva: ${invItem.name}`}
                                      </span>
                                    );
                                  })}
                                  {!isMenu && item.custom_modifications.note && (
                                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>💬 "{item.custom_modifications.note}"</span>
                                  )}
                                  {!isMenu && item.custom_modifications.linked_item && (
                                    <span style={{ color: '#0a84ff', fontWeight: 600 }}>
                                      ➕ Csatolmány: {item.custom_modifications.linked_item.name} (+{item.custom_modifications.linked_item.price_at_order.toLocaleString()} FT)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="cart-item-price-delete">
                            <span className="cart-item-price">
                              {((itemPrice + item.packaging_fee_at_order) * item.quantity).toLocaleString()} FT
                            </span>
                            <button 
                              className="cart-item-delete" 
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromCart(item.item_id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Cart details and buttons at bottom */}
              <div className="cart-actions">
                {(() => {
                  const config = db.deliveryFees || { mode: 'manual', baseFee: 500, perKmFee: 100, settlements: [] };
                  const minOrderAmount = config.minOrderAmount || 0;
                  const isDelivery = !!(customerAddress && !customerAddress.toLowerCase().includes('helyben') && !customerAddress.toLowerCase().includes('fogyasztás'));

                  const subtotal = cart.reduce((sum, item) => {
                    const price = item.custom_modifications ? item.custom_modifications.calculated_price : item.price_at_order;
                    return sum + (price + item.packaging_fee_at_order) * item.quantity;
                  }, 0);

                  const itemsTotal = cart.reduce((sum, item) => {
                    const price = item.custom_modifications ? item.custom_modifications.calculated_price : item.price_at_order;
                    return sum + price * item.quantity;
                  }, 0);
                  const packagingTotal = cart.reduce((sum, item) => {
                    return sum + item.packaging_fee_at_order * item.quantity;
                  }, 0);
                  const discountVal = (itemsTotal + packagingTotal) * (discountPercentage / 100);

                  let minSumToCheck = itemsTotal;
                  if (!config.excludePackaging) {
                    minSumToCheck += packagingTotal;
                  }
                  if (!config.excludeDelivery) {
                    minSumToCheck += deliveryFee;
                  }
                  if (!config.excludeDiscount) {
                    minSumToCheck -= discountVal;
                  }

                  const isMinOrderAmountViolated = !!(isDelivery && minOrderAmount > 0 && minSumToCheck < minOrderAmount);
                  const finalCartTotal = Math.max(0, Math.round(subtotal * (1 - discountPercentage / 100)) + deliveryFee);
                  
                  return (
                    <>
                      <div className="cart-summary" style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                          <span>Részösszeg:</span>
                          <span>{subtotal.toLocaleString()} FT</span>
                        </div>
                        {deliveryFee > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}>
                            <span>Kiszállítás {apiCalculatedDistance !== null && `(${apiCalculatedDistance.toFixed(2)} km)`}:</span>
                            <span>+{deliveryFee.toLocaleString()} FT</span>
                          </div>
                        )}
                        {discountPercentage > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                            <span>Kedvezmény ({discountPercentage}%):</span>
                            <span>-{Math.round(subtotal * (discountPercentage / 100)).toLocaleString()} FT</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: 'white', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                          <span>Összesen:</span>
                          <span style={{ color: 'var(--primary)' }}>{finalCartTotal.toLocaleString()} FT</span>
                        </div>
                      </div>

                      {isMinOrderAmountViolated && (
                        <div style={{
                          background: 'rgba(255, 69, 58, 0.12)',
                          border: '1px solid rgba(255, 69, 58, 0.3)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#ff453a',
                          fontSize: '12px',
                          marginBottom: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          fontWeight: 500
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} />
                            <span>Nem érte el a minimum összeget!</span>
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                            Kiszállítási minimum: <strong>{minOrderAmount.toLocaleString()} FT</strong> (Jelenleg beszámítva: {Math.round(minSumToCheck).toLocaleString()} FT)
                          </span>
                        </div>
                      )}

                      {/* 3 configuration buttons */}
                      <button 
                        className={`btn ${selectedCartCustomerId ? 'btn-success' : ''}`}
                        onClick={() => {
                          if (selectedCartCustomerId) {
                            const cust = db.customers.find((c: any) => c.id === selectedCartCustomerId);
                            if (cust) {
                              setSelectedCustomerIdForEdit(selectedCartCustomerId);
                              setEditingCustomerData({ ...cust });
                              setIsCreatingNewCustomer(false);
                            }
                          }
                          setIsCustomerViewActive(true);
                        }} 
                      >
                        <User size={14} />
                        Ügyfél adatai {customerName && '✓'}
                      </button>
                      
                      <button 
                        className="btn" 
                        onClick={() => {
                          setIsCustomerViewActive(false);
                          setIsPaymentViewActive(true);
                        }} 
                        disabled={cart.length === 0}
                        style={{ 
                          opacity: cart.length === 0 ? 0.6 : 1,
                          ...getPaymentMethodStyle(paymentMethod)
                        }}
                      >
                        {getPaymentMethodIcon(paymentMethod, 14)}
                        Fizetés: {paymentMethod}
                      </button>
                      
                      <button 
                        className="btn" 
                        onClick={() => setShowDiscountModal(true)} 
                        disabled={cart.length === 0}
                        style={{ opacity: cart.length === 0 ? 0.6 : 1 }}
                      >
                        <Percent size={14} />
                        Kedvezmény {discountPercentage > 0 && `(${discountPercentage}%)`}
                      </button>

                      {/* Submit / Cancel row in 4:1 ratio */}
                      <div className="cart-submit-cancel-row">
                        <button 
                          className={`btn btn-success ${cart.length > 0 && !isMinOrderAmountViolated ? 'btn-submit-order-animate' : ''}`} 
                          onClick={submitOrder}
                          disabled={cart.length === 0 || isMinOrderAmountViolated}
                          style={{ opacity: (cart.length === 0 || isMinOrderAmountViolated) ? 0.5 : 1 }}
                        >
                          Beküldés
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={clearCart}
                          disabled={cart.length === 0}
                          style={{ opacity: cart.length === 0 ? 0.6 : 1 }}
                          title="Kosár ürítése / Mégse"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </aside>

          </div>
        )}

        {/* ADMIN VIEW */}
        {view === 'admin' && currentUser?.role === 'admin' && (
          <div className="admin-view">
            
            {/* Admin Left Sidebar */}
            <aside className="admin-sidebar">
              <div className="panel-header">
                <span className="panel-title">
                  <Shield size={18} color="var(--primary)" />
                  Adminisztráció
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div 
                  className={`admin-menu-item ${adminTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setAdminTab('stats')}
                >
                  <TrendingUp size={16} />
                  Statisztikák
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'menu' ? 'active' : ''}`}
                  onClick={() => setAdminTab('menu')}
                >
                  <Layers size={16} />
                  Étlap szerkesztése
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'packaging' ? 'active' : ''}`}
                  onClick={() => setAdminTab('packaging')}
                >
                  <Package size={16} />
                  Csomagolási díjak
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'inventory' ? 'active' : ''}`}
                  onClick={() => setAdminTab('inventory')}
                >
                  <Layers size={16} />
                  Raktár szerkesztése
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'permissions' ? 'active' : ''}`}
                  onClick={() => setAdminTab('permissions')}
                >
                  <Shield size={16} />
                  Jogosultságok
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'schedule' ? 'active' : ''}`}
                  onClick={() => setAdminTab('schedule')}
                >
                  <Clock size={16} />
                  Beosztás
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'dispatch' ? 'active' : ''}`}
                  onClick={() => setAdminTab('dispatch')}
                >
                  <SendHorizontal size={16} />
                  Rendelés továbbítása
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'delivery' ? 'active' : ''}`}
                  onClick={() => setAdminTab('delivery')}
                >
                  <Truck size={16} />
                  Kiszállítási díj
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'history' ? 'active' : ''}`}
                  onClick={() => setAdminTab('history')}
                >
                  <History size={16} />
                  Előzmények
                </div>
                <div 
                  className={`admin-menu-item ${adminTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setAdminTab('settings')}
                >
                  <Settings size={16} />
                  Egyéb beállítások
                </div>
              </div>
            </aside>

            {/* Admin Main Work Area */}
            <section className="admin-main">
              
              {/* TAB: STATS / DASHBOARD */}
              {adminTab === 'stats' && (
                <>
                  <div className="admin-header">
                    <h2 className="admin-title">Vezérlőpult & Statisztikák</h2>
                  </div>

                  <div className="stats-grid">
                    <div className="stat-widget">
                      <span className="stat-label">Mai Teljesített Bevétel</span>
                      <span className="stat-value">{totalRevenue.toLocaleString()} FT</span>
                      <span className="stat-sub">▲ 12.4% tegnaphoz képest</span>
                    </div>
                    <div className="stat-widget">
                      <span className="stat-label">Folyamatban lévő érték</span>
                      <span className="stat-value">{pendingRevenue.toLocaleString()} FT</span>
                      <span className="stat-sub warning">Homokóra alatt ({activeOrders.length} db)</span>
                    </div>
                    <div className="stat-widget">
                      <span className="stat-label">Összes leadott rendelés</span>
                      <span className="stat-value">{db.orders.length} db</span>
                      <span className="stat-sub">Rendszer indulása óta</span>
                    </div>
                    <div className="stat-widget">
                      <span className="stat-label">Raktár Riasztások</span>
                      <span className="stat-value">
                        {db.inventory.filter((i: any) => i.quantity <= i.warning_limit).length} db
                      </span>
                      <span className="stat-sub warning">Azonnali pótlás szükséges</span>
                    </div>
                  </div>

                  {/* Revenue Area Chart */}
                  <div className="admin-card">
                    <span className="admin-card-title">Bevétel alakulása az elmúlt napokban (FT)</span>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <AreaChart data={getRevenueChartData()}>
                          <defs>
                            <linearGradient id="colorBevetel" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="date" stroke="var(--text-secondary)" />
                          <YAxis stroke="var(--text-secondary)" />
                          <Tooltip 
                            contentStyle={{ background: '#1c1c1e', borderColor: 'var(--glass-border)', color: '#fff' }} 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="bevetel" 
                            stroke="var(--primary)" 
                            fillOpacity={1} 
                            fill="url(#colorBevetel)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    
                    {/* Category Sales Pie Chart */}
                    <div className="admin-card">
                      <span className="admin-card-title">Eladások kategóriák szerint</span>
                      <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getCategoryChartData()}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {getCategoryChartData().map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Stock Alert Bar Chart */}
                    <div className="admin-card">
                      <span className="admin-card-title">Raktárkészlet vs Minimális limit</span>
                      <div style={{ width: '100%', height: 220 }}>
                        <ResponsiveContainer>
                          <BarChart data={getInventoryChartData().slice(0, 5)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="nev" stroke="var(--text-secondary)" />
                            <YAxis stroke="var(--text-secondary)" />
                            <Tooltip 
                              contentStyle={{ background: '#1c1c1e', borderColor: 'var(--glass-border)' }}
                            />
                            <Legend />
                            <Bar dataKey="mennyiseg" fill="var(--primary)" name="Készlet" />
                            <Bar dataKey="limit" fill="var(--danger)" name="Riasztási limit" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>
                </>
              )}

              {/* TAB: EDIT MENU */}
              {adminTab === 'menu' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', overflow: 'hidden' }}>
                  <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <h2 className="admin-title" style={{ margin: 0 }}>Étlap szerkesztése</h2>
                      {/* Sliding tab selector & Filter Button on the left, Action Button on the right */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="menu-sliding-toggle-container" style={{ height: '38px', alignItems: 'center' }}>
                            <div className={`menu-sliding-toggle-indicator ${menuSubTab}`} />
                            <button 
                              onClick={() => setMenuSubTab('items')}
                              className={`menu-sliding-toggle-btn ${menuSubTab === 'items' ? 'active' : ''}`}
                              style={{ width: '110px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                            >
                              Ételcikkek
                            </button>
                            <button 
                              onClick={() => setMenuSubTab('categories')}
                              className={`menu-sliding-toggle-btn ${menuSubTab === 'categories' ? 'active' : ''}`}
                              style={{ width: '110px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                            >
                              Kategóriák
                            </button>
                          </div>

                          {menuSubTab === 'items' && (
                            <button 
                              onClick={() => setShowFilterPanel(!showFilterPanel)}
                              className={`filter-toggle-btn ${showFilterPanel ? 'active' : ''}`}
                              title="Szűrés és Rendezés"
                            >
                              <SlidersHorizontal size={14} style={{ flexShrink: 0 }} />
                              <span className="filter-toggle-text">Szűrés és Rendezés</span>
                            </button>
                          )}
                        </div>

                        {/* Slide animation container for add buttons (matching outer height of 38px) */}
                        <div style={{ position: 'relative', height: '38px', width: '220px' }}>
                          <button 
                            className="btn btn-primary"
                            style={{ 
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              height: '38px',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              padding: '0 14px', 
                              fontSize: '13px', 
                              borderRadius: 'var(--radius-md)', 
                              fontWeight: 600, 
                              border: 'none', 
                              cursor: 'pointer',
                              transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                              opacity: menuSubTab === 'items' ? 1 : 0,
                              transform: menuSubTab === 'items' ? 'translateX(0)' : 'translateX(20px)',
                              pointerEvents: menuSubTab === 'items' ? 'auto' : 'none'
                            }}
                            onClick={() => {
                              setEditingItem({ id: 0, category_id: lastAddedCatId, name: '', price: 0, packaging_fee: lastAddedPackFee });
                              setEditingItemTab('general');
                              setNewItemName('');
                              setNewItemPrice('');
                              setNewItemPackFee(lastAddedPackFee);
                              setNewItemPackType(lastAddedPackType);
                              setNewItemCatId(lastAddedCatId);
                              setNewItemDescription('');
                              setNewItemIngredients([]);
                              if (db.inventory.length > 0) {
                                setSelectedAddIngredientId(db.inventory[0].id);
                                setSelectedAddIngredientQty(1);
                              } else {
                                setSelectedAddIngredientId(null);
                                setSelectedAddIngredientQty(0);
                              }
                            }}
                          >
                            <Plus size={16} /> Új étel hozzáadása
                          </button>

                          <button 
                            className="btn"
                            style={{ 
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              height: '38px',
                              background: '#bf5af2', 
                              color: 'white', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              boxShadow: '0 0 10px rgba(191, 90, 242, 0.3)', 
                              padding: '0 14px', 
                              fontSize: '13px', 
                              borderRadius: 'var(--radius-md)', 
                              fontWeight: 600, 
                              border: 'none', 
                              cursor: 'pointer',
                              transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                              opacity: menuSubTab === 'categories' ? 1 : 0,
                              transform: menuSubTab === 'categories' ? 'translateX(0)' : 'translateX(-20px)',
                              pointerEvents: menuSubTab === 'categories' ? 'auto' : 'none'
                            }}
                            onClick={() => {
                              setEditingCategory({ id: 0, name: '', description: '', is_active: true });
                              setEditingCategoryTab('general');
                              setNewCatName('');
                              setNewCatDescription('');
                              setNewCatLinkedCategoryId('none');
                              setNewCatIncludeLinkedPackagingFee(false);
                            }}
                          >
                            <Plus size={16} /> Új kategória hozzáadása
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Add / Edit Form Modal card overlay */}
                  {editingItem && (
                    <div className="modal-overlay" onClick={() => setEditingItem(null)}>
                      <div className="modal-card" style={{
                        maxWidth: '950px',
                        width: '95%',
                        height: `${tabHeight + (editingItemTab === 'general' ? 290 : 340)}px`,
                        maxHeight: '95vh',
                        background: 'var(--panel-bg)',
                        border: '1px solid var(--glass-border)',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        transition: 'height 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                        overflow: 'hidden'
                      }} onClick={e => e.stopPropagation()}>
                        
                        <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
                            {editingItem.id === 0 ? 'Új Étel felvétele' : 'Étel szerkesztése'}
                          </span>
                          <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', transition: 'background-color 0.2s' }} onClick={() => setEditingItem(null)}>
                            <X size={18} />
                          </button>
                        </div>

                        {/* Tab Selector Navbar */}
                        <div style={{
                          display: 'flex',
                          background: 'rgba(255, 255, 255, 0.04)',
                          borderRadius: '10px',
                          padding: '4px',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                          {[
                            { id: 'general', label: 'Általános', icon: <Info size={14} /> },
                            { id: 'promo', label: 'Időzítés', icon: <Clock size={14} /> },
                            { id: 'ingredients', label: 'Alapanyagok', icon: <Package size={14} /> }
                          ].map(tab => {
                            const isActive = editingItemTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setEditingItemTab(tab.id as any)}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  padding: '10px 16px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: isActive ? '#0a84ff' : 'transparent',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
                                  boxShadow: isActive ? '0 2px 8px rgba(10,132,255,0.4)' : 'none'
                                }}
                              >
                                {tab.icon}
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Context Header (shown on non-General tabs) */}
                        {editingItemTab !== 'general' && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(10,132,255,0.08)',
                            border: '1px solid rgba(10,132,255,0.15)',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            fontSize: '13px',
                            color: 'white'
                          }}>
                            <span style={{ fontWeight: 600, color: '#0a84ff' }}>📍 Szerkesztett étel:</span>
                            <span style={{ fontWeight: 700 }}>{newItemName || 'Névtelen étel'}</span>
                            <span style={{ opacity: 0.4 }}>•</span>
                            <span style={{ fontWeight: 600, color: '#0a84ff' }}>Kategória:</span>
                            <span style={{ fontWeight: 700 }}>
                              {db.categories.find((c: any) => c.id === newItemCatId)?.name || 'Ismeretlen'}
                            </span>
                          </div>
                        )}

                        {/* Modal Scrollable Body */}
                        <div style={{
                          flex: 1,
                          minHeight: 0,
                          overflow: 'visible',
                          paddingRight: '4px'
                        }}>
                          
                          {/* TAB 1: GENERAL */}
                          {editingItemTab === 'general' && (
                            <div ref={tabContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                              <div>
                                <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Étel Neve</label>
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  style={{ height: '46px', fontSize: '15px', padding: '0 16px', borderRadius: '8px' }}
                                  value={newItemName} 
                                  onChange={e => setNewItemName(e.target.value)} 
                                  placeholder="pl: Pizza Prosciutto"
                                />
                              </div>

                              <div>
                                <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Leírás / Összetevők röviden (étlapon megjelenő)</label>
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  style={{ height: '46px', fontSize: '15px', padding: '0 16px', borderRadius: '8px' }}
                                  value={newItemDescription} 
                                  onChange={e => setNewItemDescription(e.target.value)} 
                                  placeholder="pl: paradicsomszósz, sonka, gomba..."
                                />
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                                <div>
                                  <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Kategória</label>
                                  <AppleSelect
                                    value={newItemCatId}
                                    onChange={val => setNewItemCatId(Number(val))}
                                    options={db.categories.map((c: any) => ({
                                      value: c.id,
                                      label: c.name
                                    }))}
                                    icon={<Layers size={14} />}
                                    isOpen={openItemCatDropdown}
                                    onToggle={() => setOpenItemCatDropdown(!openItemCatDropdown)}
                                    onClose={() => setOpenItemCatDropdown(false)}
                                  />
                                </div>

                                <div>
                                  <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Ár (FT)</label>
                                  <input 
                                    type="number" 
                                    className="input-field" 
                                    style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px' }}
                                    value={newItemPrice} 
                                    onChange={e => setNewItemPrice(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} 
                                  />
                                </div>

                                <div>
                                  <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Csomagolás</label>
                                  <AppleSelect
                                    value={newItemPackType}
                                    onChange={val => {
                                      const type = String(val);
                                      setNewItemPackType(type);
                                      if (type === 'none') {
                                        setNewItemPackFee(0);
                                      } else {
                                        setNewItemPackFee(db.packagingFees[type] || 0);
                                      }
                                    }}
                                    options={[
                                      { value: 'none', label: 'Nincs csomagolás (0 FT)' },
                                      ...Object.keys(db.packagingFees).map(key => ({
                                        value: key,
                                        label: key === 'pizza' ? 'Pizza doboz' : key === 'box' ? 'Elv. doboz' : key === 'cup' ? 'Pohár' : key
                                      }))
                                    ]}
                                    icon={<Package size={14} />}
                                    isOpen={openItemPackDropdown}
                                    onToggle={() => setOpenItemPackDropdown(!openItemPackDropdown)}
                                    onClose={() => setOpenItemPackDropdown(false)}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 2: PROMOTION / TIMING */}
                          {editingItemTab === 'promo' && (
                            <div ref={tabContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                              {(() => {
                                const itemCategory = db.categories.find((c: any) => c.id === newItemCatId);
                                const hasCategoryPromotion = !!(itemCategory && itemCategory.promotion?.isEnabled);
                                const categoryName = itemCategory ? itemCategory.name : '';
                                return (
                                  <div ref={promoPanelRef} style={{
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '12px',
                                    padding: '16px 20px',
                                    background: 'rgba(255,255,255,0.02)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0a84ff' }}>
                                        Időzített Árazás & Akciók Beállítása
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                          {promoIsEnabled ? 'Aktív' : 'Deaktív'}
                                        </span>
                                        <div 
                                          onClick={() => {
                                            const nextVal = !promoIsEnabled;
                                            setPromoIsEnabled(nextVal);
                                            if (nextVal) {
                                              setTimeout(() => {
                                                promoPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                              }, 80);
                                            }
                                          }}
                                          style={{
                                            width: '44px',
                                            height: '24px',
                                            borderRadius: '12px',
                                            background: promoIsEnabled ? '#30d158' : 'rgba(255,255,255,0.15)',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s ease',
                                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
                                          }}
                                        >
                                          <div 
                                            style={{
                                              width: '20px',
                                              height: '20px',
                                              borderRadius: '50%',
                                              background: 'white',
                                              position: 'absolute',
                                              top: '2px',
                                              left: promoIsEnabled ? '22px' : '2px',
                                              transition: 'left 0.2s ease',
                                              boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {promoIsEnabled ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                                        {hasCategoryPromotion && (
                                          <div style={{
                                            background: 'rgba(255, 159, 10, 0.12)',
                                            border: '1px solid rgba(255, 159, 10, 0.25)',
                                            borderRadius: '8px',
                                            padding: '8px 12px',
                                            color: '#ff9f0a',
                                            fontSize: '13px',
                                            lineHeight: '1.5',
                                            fontWeight: 500
                                          }}>
                                            ⚠️ Figyelem: A(z) <strong>{categoryName}</strong> kategóriára már be van állítva egy aktív árazási szabály. Ha ide is beállítasz egy szabályt, az felülírja a kategória szintű beállítást (ez az étel prioritást élvez).
                                          </div>
                                        )}

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                          <div>
                                            <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Típus</label>
                                            <AppleSelect
                                              value={promoType}
                                              onChange={val => setPromoType(val as 'once' | 'recurring')}
                                              options={[
                                                { value: 'once', label: 'Egy alkalommal' },
                                                { value: 'recurring', label: 'Ismétlődő' }
                                              ]}
                                              icon={<Activity size={14} />}
                                              isOpen={openPromoTypeDropdown}
                                              onToggle={() => setOpenPromoTypeDropdown(!openPromoTypeDropdown)}
                                              onClose={() => setOpenPromoTypeDropdown(false)}
                                            />
                                          </div>

                                          {promoType === 'once' ? (
                                            <div>
                                              <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Dátum</label>
                                              <input 
                                                type="date"
                                                className="input-field"
                                                style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px' }}
                                                value={promoOnceDate}
                                                onChange={e => setPromoOnceDate(e.target.value)}
                                              />
                                            </div>
                                          ) : (
                                            <div>
                                              <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Gyakoriság</label>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <input 
                                                  type="number"
                                                  className="input-field"
                                                  style={{ height: '42px', fontSize: '14px', width: '80px', padding: '0 12px', borderRadius: '8px' }}
                                                  min={1}
                                                  value={promoRecurringWeeksInterval}
                                                  onChange={e => setPromoRecurringWeeksInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                                />
                                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>hetenként</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {promoType === 'recurring' && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div>
                                              <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Ismétlődés napjai</label>
                                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {[
                                                  { val: 1, label: 'Hétfő' },
                                                  { val: 2, label: 'Kedd' },
                                                  { val: 3, label: 'Szerda' },
                                                  { val: 4, label: 'Csütörtök' },
                                                  { val: 5, label: 'Péntek' },
                                                  { val: 6, label: 'Szombat' },
                                                  { val: 7, label: 'Vasárnap' }
                                                ].map(day => {
                                                  const isSelected = promoRecurringDays.includes(day.val);
                                                  return (
                                                    <button
                                                      key={day.val}
                                                      type="button"
                                                      onClick={() => {
                                                        if (isSelected) {
                                                          setPromoRecurringDays(promoRecurringDays.filter(d => d !== day.val));
                                                        } else {
                                                          setPromoRecurringDays([...promoRecurringDays, day.val].sort());
                                                        }
                                                      }}
                                                      style={{
                                                        padding: '8px 14px',
                                                        borderRadius: '8px',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        background: isSelected ? '#0a84ff' : 'rgba(0,0,0,0.2)',
                                                        color: 'white',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                      }}
                                                    >
                                                      {day.label}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>

                                            {promoRecurringWeeksInterval > 1 && (
                                              <div>
                                                <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Kezdő dátum (referencia hét)</label>
                                                <input 
                                                  type="date"
                                                  className="input-field"
                                                  style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px' }}
                                                  value={promoRecurringStartDate}
                                                  onChange={e => setPromoRecurringStartDate(e.target.value)}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                          <div>
                                            <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Módosítás típusa</label>
                                            <AppleSelect
                                              value={promoPriceAdjustmentType}
                                              onChange={val => setPromoPriceAdjustmentType(val as 'percent' | 'fixed')}
                                              options={[
                                                { value: 'percent', label: 'Százalékos kedvezmény / felár (%)' },
                                                { value: 'fixed', label: 'Fix összegű akciós ár (FT)' }
                                              ]}
                                              icon={<Layers size={14} />}
                                              isOpen={openPromoPriceDropdown}
                                              onToggle={() => setOpenPromoPriceDropdown(!openPromoPriceDropdown)}
                                              onClose={() => setOpenPromoPriceDropdown(false)}
                                            />
                                          </div>

                                          <div>
                                            <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                                              {promoPriceAdjustmentType === 'percent' ? 'Módosítás mértéke (pl. -10 vagy +15) (%)' : 'Új akciós ár (FT)'}
                                            </label>
                                            <input 
                                              type="number"
                                              className="input-field"
                                              style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px' }}
                                              value={promoPriceAdjustmentValue}
                                              onChange={e => setPromoPriceAdjustmentValue(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                              placeholder={promoPriceAdjustmentType === 'percent' ? 'pl: -10' : 'pl: 1500'}
                                            />
                                          </div>
                                        </div>

                                        <div>
                                          <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Csomagolási díj kezelése akció alatt</label>
                                          <AppleSelect
                                            value={promoPackagingFeePolicy}
                                            onChange={val => setPromoPackagingFeePolicy(val as 'standard' | 'free' | 'discounted')}
                                            options={[
                                              { value: 'standard', label: 'Rendes árán marad' },
                                              { value: 'free', label: 'Ingyenes csomagolás az akciós napokon' },
                                              { value: 'discounted', label: 'Ugyanaz a százalékos kedvezmény jöjjön le belőle' }
                                            ]}
                                            icon={<Package size={14} />}
                                            isOpen={openPromoPackDropdown}
                                            onToggle={() => setOpenPromoPackDropdown(!openPromoPackDropdown)}
                                            onClose={() => setOpenPromoPackDropdown(false)}
                                            openUpward={true}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                                        <span style={{ fontSize: '14px', fontStyle: 'italic' }}>Az időzített árazások nincsenek engedélyezve ehhez az ételhez.</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* TAB 3: INGREDIENTS */}
                          {editingItemTab === 'ingredients' && (
                            <div ref={tabContentRef} style={{
                              display: 'grid',
                              gridTemplateColumns: '1.2fr 1fr',
                              gap: '24px',
                              padding: '10px 0',
                            }}>
                              {/* Column A: Existing Ingredients List */}
                              <div style={{ 
                                background: 'rgba(255, 255, 255, 0.01)', 
                                border: '1px solid rgba(255, 255, 255, 0.05)', 
                                borderRadius: '12px', 
                                padding: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '430px'
                              }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#30d158', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                  <Package size={18} /> Receptek & Recept összetevők ({newItemIngredients.length} db)
                                </span>

                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '8px' }}>
                                  {newItemIngredients.map((ing: any) => {
                                    const invItem = db.inventory.find((i: any) => i.id === ing.ingredientId);
                                    if (!invItem) return null;
                                    const allergens = detectAllergens(invItem.name);

                                    return (
                                      <div key={ing.ingredientId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', transition: 'all 0.15s ease' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>
                                            {invItem.name}
                                          </span>
                                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            Szükséges mennyiség: <strong style={{ color: 'var(--primary)', fontSize: '13px' }}>{ing.quantity} {invItem.unit}</strong>
                                          </span>
                                          {allergens.length > 0 && (
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                              {allergens.map((a: any) => (
                                                <span 
                                                  key={a.code} 
                                                  style={{ background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.25)', color: '#ff9f0a', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}
                                                  title={"EU Allergén: " + a.name}
                                                >
                                                  ⚠️ {a.name}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <button 
                                          type="button"
                                          className="btn" 
                                          style={{ padding: '8px 12px', background: 'rgba(255,69,58,0.12)', color: '#ff453a', border: '1px solid rgba(255,69,58,0.2)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                                          onClick={() => {
                                            setNewItemIngredients(newItemIngredients.filter((i: any) => i.ingredientId !== ing.ingredientId));
                                          }}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                  {newItemIngredients.length === 0 && (
                                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '200px', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px', padding: '24px' }}>
                                      <span style={{ fontSize: '14px', fontStyle: 'italic' }}>Még nincsenek alapanyagok hozzáadva.</span>
                                      <span style={{ fontSize: '12px', textAlign: 'center', opacity: 0.6 }}>Használd a jobb oldali panelt a recept összeállításához!</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Column B: Add New Ingredient Form */}
                              <div style={{ 
                                background: 'rgba(0, 0, 0, 0.12)', 
                                border: '1px solid rgba(255, 255, 255, 0.04)', 
                                borderRadius: '12px', 
                                padding: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                gap: '16px'
                              }}>
                                <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Új összetevő hozzáadása
                                </span>

                                <div>
                                  <label className="input-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Alapanyag választása</label>
                                  <AppleSelect
                                    value={selectedAddIngredientId || ''}
                                    onChange={val => setSelectedAddIngredientId(Number(val) || null)}
                                    options={db.inventory
                                      .filter((inv: any) => !newItemIngredients.some((ing: any) => ing.ingredientId === inv.id))
                                      .map((inv: any) => ({
                                        value: inv.id,
                                        label: inv.name
                                      }))
                                    }
                                    icon={<Package size={14} />}
                                    isOpen={openItemIngredDropdown}
                                    onToggle={() => setOpenItemIngredDropdown(!openItemIngredDropdown)}
                                    onClose={() => setOpenItemIngredDropdown(false)}
                                    openUpward={true}
                                  />
                                </div>

                                <div>
                                  <label className="input-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                                    Mennyiség ({db.inventory.find((i: any) => i.id === selectedAddIngredientId)?.unit || 'egység'})
                                  </label>
                                  <input
                                    type="number"
                                    className="input-field"
                                    style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px' }}
                                    value={selectedAddIngredientQty}
                                    onChange={e => setSelectedAddIngredientQty(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                    step="any"
                                  />
                                </div>

                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ height: '44px', padding: '0 20px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', width: '100%', fontWeight: 600 }}
                                  onClick={() => {
                                    const qty = Number(selectedAddIngredientQty) || 0;
                                    if (!selectedAddIngredientId || qty <= 0) return;
                                    setNewItemIngredients([
                                      ...newItemIngredients,
                                      { ingredientId: selectedAddIngredientId, quantity: qty }
                                    ]);
                                    // Reset select to next available in inventory
                                    const remaining = db.inventory.filter((inv: any) => 
                                      inv.id !== selectedAddIngredientId && 
                                      !newItemIngredients.some((ing: any) => ing.ingredientId === inv.id)
                                    );
                                    if (remaining.length > 0) {
                                      setSelectedAddIngredientId(remaining[0].id);
                                    } else {
                                      setSelectedAddIngredientId(null);
                                    }
                                    setSelectedAddIngredientQty('');
                                  }}
                                  disabled={!selectedAddIngredientId}
                                >
                                  <Plus size={16} /> Alapanyag Hozzáadása
                                </button>
                              </div>
                            </div>
                          )}

                        </div>

                        {/* Modal Footer actions */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--glass-border)' }}>
                          <button 
                            type="button"
                            className="btn" 
                            style={{ padding: '10px 28px', borderRadius: '20px', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '13px' }}
                            onClick={() => setEditingItem(null)}
                          >
                            Mégse
                          </button>
                          <button 
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '10px 28px', borderRadius: '20px', fontWeight: 600, background: '#0a84ff', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(10,132,255,0.3)', fontSize: '13px' }}
                            onClick={() => {
                              if (!newItemName.trim()) return;

                              // Auto compute unique allergens list
                              const uniqueAllergens = new Set();
                              newItemIngredients.forEach((ing: any) => {
                                const inv = db.inventory.find((i: any) => i.id === ing.ingredientId);
                                if (inv) {
                                  const matches = detectAllergens(inv.name);
                                  matches.forEach((m: any) => uniqueAllergens.add(m.code));
                                }
                              });
                              const finalAllergens = Array.from(uniqueAllergens).sort((a: any, b: any) => parseInt(a) - parseInt(b));

                              const promoObj = {
                                isEnabled: promoIsEnabled,
                                type: promoType,
                                onceDate: promoType === 'once' ? promoOnceDate : undefined,
                                recurringDays: promoType === 'recurring' ? promoRecurringDays : undefined,
                                recurringWeeksInterval: promoType === 'recurring' ? promoRecurringWeeksInterval : undefined,
                                recurringStartDate: promoType === 'recurring' && promoRecurringWeeksInterval > 1 ? promoRecurringStartDate : undefined,
                                priceAdjustmentType: promoPriceAdjustmentType,
                                priceAdjustmentValue: promoPriceAdjustmentValue,
                                packagingFeePolicy: promoPackagingFeePolicy
                              };

                              let updatedItems = [...db.items];
                              if (editingItem.id === 0) {
                                const newId = db.items.length > 0 ? Math.max(...db.items.map((i: any) => i.id)) + 1 : 1;
                                updatedItems.push({
                                  id: newId,
                                  category_id: newItemCatId,
                                  name: newItemName,
                                  price: Number(newItemPrice) || 0,
                                  packaging_fee: Number(newItemPackFee) || 0,
                                  packaging_type: newItemPackType,
                                  description: newItemDescription,
                                  ingredients: newItemIngredients,
                                  allergens: finalAllergens,
                                  promotion: promoObj
                                });
                                // Save last added item defaults
                                setLastAddedCatId(newItemCatId);
                                setLastAddedPackType(newItemPackType);
                                setLastAddedPackFee(Number(newItemPackFee) || 0);
                              } else {
                                updatedItems = db.items.map((i: any) => i.id === editingItem.id ? {
                                  ...i,
                                  name: newItemName,
                                  price: Number(newItemPrice) || 0,
                                  packaging_fee: Number(newItemPackFee) || 0,
                                  packaging_type: newItemPackType,
                                  description: newItemDescription,
                                  ingredients: newItemIngredients,
                                  allergens: finalAllergens,
                                  promotion: promoObj
                                } : i);
                              }
                              saveDatabase({ ...db, items: updatedItems });
                              setEditingItem(null);
                            }}
                          >
                            Mentés
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Add / Edit Category Modal Overlay */}
                  {editingCategory && (
                    <div className="modal-overlay" onClick={() => setEditingCategory(null)}>
                      <div className="modal-card" style={{
                        maxWidth: '950px',
                        width: '95%',
                        height: `${catModalHeight + (editingCategoryTab === 'general' ? 270 : 320)}px`,
                        maxHeight: '95vh',
                        background: 'var(--panel-bg)',
                        border: '1px solid var(--glass-border)',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        transition: 'height 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                        overflow: 'hidden'
                      }} onClick={e => e.stopPropagation()}>
                        
                        <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
                            {editingCategory.id === 0 ? 'Új Kategória hozzáadása' : 'Kategória szerkesztése'}
                          </span>
                          <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', transition: 'background-color 0.2s' }} onClick={() => setEditingCategory(null)}>
                            <X size={18} />
                          </button>
                        </div>

                        {/* Tab Selector Navbar */}
                        <div style={{
                          display: 'flex',
                          background: 'rgba(255, 255, 255, 0.04)',
                          borderRadius: '10px',
                          padding: '4px',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                          {[
                            { id: 'general', label: 'Általános', icon: <Info size={14} /> },
                            { id: 'promo', label: 'Időzítés', icon: <Clock size={14} /> },
                            { id: 'menu_mode', label: 'Menü mód', icon: <Layers size={14} /> }
                          ].map(tab => {
                            const isActive = editingCategoryTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setEditingCategoryTab(tab.id as any)}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  padding: '10px 16px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: isActive ? '#0a84ff' : 'transparent',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
                                  boxShadow: isActive ? '0 2px 8px rgba(10,132,255,0.4)' : 'none'
                                }}
                              >
                                {tab.icon}
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Context Header */}
                        {editingCategoryTab !== 'general' && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(10,132,255,0.08)',
                            border: '1px solid rgba(10,132,255,0.15)',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            fontSize: '13px',
                            color: 'white'
                          }}>
                            <span style={{ fontWeight: 600, color: '#0a84ff' }}>📍 Szerkesztett kategória:</span>
                            <span style={{ fontWeight: 700 }}>{newCatName || 'Névtelen kategória'}</span>
                          </div>
                        )}

                        {/* Modal Body */}
                        <div style={{
                          flex: 1,
                          minHeight: 0,
                          overflow: 'visible',
                          paddingRight: '4px'
                        }}>
                          
                          {/* TAB 1: GENERAL */}
                          {editingCategoryTab === 'general' && (
                            <div ref={catModalContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                              <div>
                                <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Kategória Név</label>
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  style={{ height: '46px', fontSize: '15px', padding: '0 16px', borderRadius: '8px' }}
                                  value={newCatName} 
                                  onChange={e => setNewCatName(e.target.value)} 
                                  placeholder="pl: Pizzák, Tészták, Desszertek"
                                />
                              </div>

                              <div>
                                <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Leírás</label>
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  style={{ height: '46px', fontSize: '15px', padding: '0 16px', borderRadius: '8px' }}
                                  value={newCatDescription} 
                                  onChange={e => setNewCatDescription(e.target.value)} 
                                  placeholder="pl: Kemencében sült pizzáink..."
                                />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Menüs kategóriává alakítás?</span>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Kapcsold be, ha ebben a kategóriában menüket (több fogásos választékot) akarsz értékesíteni.</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
                                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {newCatIsMenuCategory ? 'Igen (Menü)' : 'Nem (Sima)'}
                                  </span>
                                  <div 
                                    onClick={() => {
                                      if (newCatLinkedCategoryId !== 'none') {
                                        alert('Csatolt kategóriával rendelkező kategória nem lehet Menüs kategória! Távolítsd el a csatolt kategóriát először.');
                                        return;
                                      }
                                      setNewCatIsMenuCategory(!newCatIsMenuCategory);
                                    }}
                                    style={{
                                      width: '44px',
                                      height: '24px',
                                      borderRadius: '12px',
                                      background: newCatIsMenuCategory ? '#30d158' : 'rgba(255,255,255,0.15)',
                                      position: 'relative',
                                      cursor: 'pointer',
                                      transition: 'background-color 0.2s ease',
                                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
                                    }}
                                  >
                                    <div 
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '2px',
                                        left: newCatIsMenuCategory ? '22px' : '2px',
                                        transition: 'left 0.2s ease',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {!newCatIsMenuCategory && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div>
                                    <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Csatolt Kategória (opcionális)</label>
                                    <AppleSelect
                                      value={newCatLinkedCategoryId}
                                      onChange={val => setNewCatLinkedCategoryId(val === 'none' ? 'none' : Number(val))}
                                      options={[
                                        { value: 'none', label: 'Nincs csatolt kategória' },
                                        ...db.categories
                                          .filter((c: any) => c.id !== editingCategory.id)
                                          .map((c: any) => ({ value: c.id, label: c.name }))
                                      ]}
                                      icon={<Layers size={14} />}
                                      isOpen={openCatLinkDropdown}
                                      onToggle={() => setOpenCatLinkDropdown(!openCatLinkDropdown)}
                                      onClose={() => setOpenCatLinkDropdown(false)}
                                      openUpward={true}
                                    />
                                  </div>

                                  {newCatLinkedCategoryId !== 'none' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                                      <input 
                                        type="checkbox" 
                                        id="newCatIncludeLinkedPackagingFee"
                                        checked={newCatIncludeLinkedPackagingFee}
                                        onChange={e => setNewCatIncludeLinkedPackagingFee(e.target.checked)}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          accentColor: '#0a84ff',
                                          cursor: 'pointer'
                                        }}
                                      />
                                      <label 
                                        htmlFor="newCatIncludeLinkedPackagingFee" 
                                        style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                      >
                                        Csatolt csomagolási díj felszámítása
                                      </label>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 2: PROMOTION / TIMING */}
                          {editingCategoryTab === 'promo' && (
                            <div ref={catModalContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                              <div style={{
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                background: 'rgba(255,255,255,0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#0a84ff' }}>
                                    Időzített Árazás & Akciók Beállítása
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                      {promoIsEnabled ? 'Aktív' : 'Deaktív'}
                                    </span>
                                    <div 
                                      onClick={() => {
                                        const nextVal = !promoIsEnabled;
                                        setPromoIsEnabled(nextVal);
                                      }}
                                      style={{
                                        width: '44px',
                                        height: '24px',
                                        borderRadius: '12px',
                                        background: promoIsEnabled ? '#30d158' : 'rgba(255,255,255,0.15)',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s ease',
                                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
                                      }}
                                    >
                                      <div 
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          borderRadius: '50%',
                                          background: 'white',
                                          position: 'absolute',
                                          top: '2px',
                                          left: promoIsEnabled ? '22px' : '2px',
                                          transition: 'left 0.2s ease',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {promoIsEnabled ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                      <div>
                                        <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Típus</label>
                                        <AppleSelect
                                          value={promoType}
                                          onChange={val => setPromoType(val as 'once' | 'recurring')}
                                          options={[
                                            { value: 'once', label: 'Egy alkalommal' },
                                            { value: 'recurring', label: 'Ismétlődő' }
                                          ]}
                                          icon={<Activity size={14} />}
                                          isOpen={openPromoTypeDropdown}
                                          onToggle={() => setOpenPromoTypeDropdown(!openPromoTypeDropdown)}
                                          onClose={() => setOpenPromoTypeDropdown(false)}
                                        />
                                      </div>

                                      {promoType === 'once' ? (
                                        <div>
                                          <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Dátum</label>
                                          <input 
                                            type="date"
                                            className="input-field"
                                            style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px' }}
                                            value={promoOnceDate}
                                            onChange={e => setPromoOnceDate(e.target.value)}
                                          />
                                        </div>
                                      ) : (
                                        <div>
                                          <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Gyakoriság</label>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input 
                                              type="number"
                                              className="input-field"
                                              style={{ height: '42px', fontSize: '14px', width: '80px', padding: '0 12px', borderRadius: '8px' }}
                                              min={1}
                                              value={promoRecurringWeeksInterval}
                                              onChange={e => setPromoRecurringWeeksInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                            />
                                            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>hetenként</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {promoType === 'recurring' && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div>
                                          <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Ismétlődés napjai</label>
                                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {[
                                              { val: 1, label: 'Hétfő' },
                                              { val: 2, label: 'Kedd' },
                                              { val: 3, label: 'Szerda' },
                                              { val: 4, label: 'Csütörtök' },
                                              { val: 5, label: 'Péntek' },
                                              { val: 6, label: 'Szombat' },
                                              { val: 7, label: 'Vasárnap' }
                                            ].map(day => {
                                              const isSelected = promoRecurringDays.includes(day.val);
                                              return (
                                                <button
                                                  key={day.val}
                                                  type="button"
                                                  onClick={() => {
                                                    if (isSelected) {
                                                      setPromoRecurringDays(promoRecurringDays.filter(d => d !== day.val));
                                                    } else {
                                                      setPromoRecurringDays([...promoRecurringDays, day.val].sort());
                                                    }
                                                  }}
                                                  style={{
                                                    padding: '8px 14px',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    background: isSelected ? '#0a84ff' : 'rgba(0,0,0,0.2)',
                                                    color: 'white',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                  }}
                                                >
                                                  {day.label}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        {promoRecurringWeeksInterval > 1 && (
                                          <div>
                                            <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Kezdő dátum (referencia hét)</label>
                                            <input 
                                              type="date"
                                              className="input-field"
                                              style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px' }}
                                              value={promoRecurringStartDate}
                                              onChange={e => setPromoRecurringStartDate(e.target.value)}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                      <div>
                                        <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Módosítás típusa</label>
                                        <input 
                                          type="text" 
                                          className="input-field" 
                                          style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)' }}
                                          value="Százalékos kedvezmény (%)" 
                                          readOnly
                                        />
                                      </div>

                                      <div>
                                        <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                                          Kedvezmény mértéke (százalékban, pl: -10) (%)
                                        </label>
                                        <input 
                                          type="number"
                                          className="input-field"
                                          style={{ height: '42px', fontSize: '14px', padding: '0 12px', borderRadius: '8px' }}
                                          value={promoPriceAdjustmentValue}
                                          onChange={e => setPromoPriceAdjustmentValue(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                          placeholder="pl: -10"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="input-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Csomagolási díj kezelése akció alatt</label>
                                      <AppleSelect
                                        value={promoPackagingFeePolicy}
                                        onChange={val => setPromoPackagingFeePolicy(val as 'standard' | 'free' | 'discounted')}
                                        options={[
                                          { value: 'standard', label: 'Rendes árán marad' },
                                          { value: 'free', label: 'Ingyenes csomagolás az akciós napokon' },
                                          { value: 'discounted', label: 'Ugyanaz a százalékos kedvezmény jöjjön le belőle' }
                                        ]}
                                        icon={<Package size={14} />}
                                        isOpen={openPromoPackDropdown}
                                        onToggle={() => setOpenPromoPackDropdown(!openPromoPackDropdown)}
                                        onClose={() => setOpenPromoPackDropdown(false)}
                                        openUpward={true}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '14px', fontStyle: 'italic' }}>Az időzített árazások nincsenek engedélyezve ehhez a kategóriához.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* TAB 3: MENU MODE */}
                          {editingCategoryTab === 'menu_mode' && (
                            <div ref={catModalContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                              {!newCatIsMenuCategory ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px', padding: '24px' }}>
                                  <span style={{ fontSize: '24px' }}>⚠️</span>
                                  <span style={{ fontSize: '14px', textAlign: 'center', fontWeight: 600 }}>A Menü Mód beállításai nem elérhetőek.</span>
                                  <span style={{ fontSize: '12px', textAlign: 'center', opacity: 0.6 }}>Lépj az Általános fülre, és kapcsold be a "Menüs Kategória" kapcsolót!</span>
                                </div>
                              ) : (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1.2fr 1.8fr',
                                  gap: '24px',
                                  padding: '10px 0'
                                }}>
                                  {/* Column A: Schedule */}
                                  <div style={{
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    background: 'rgba(255,255,255,0.02)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '14px'
                                  }}>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0a84ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <Clock size={16} /> Menü Elérhetőség
                                    </span>
                                    
                                    <div>
                                      <label className="input-label" style={{ fontSize: '12px', marginBottom: '6px', display: 'block' }}>Aktív napok</label>
                                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        {[
                                          { val: 1, label: 'H' },
                                          { val: 2, label: 'K' },
                                          { val: 3, label: 'Sze' },
                                          { val: 4, label: 'Cs' },
                                          { val: 5, label: 'P' },
                                          { val: 6, label: 'Szo' },
                                          { val: 7, label: 'V' }
                                        ].map(day => {
                                          const isSelected = newCatScheduleDays.includes(day.val);
                                          return (
                                            <button
                                              key={day.val}
                                              type="button"
                                              onClick={() => {
                                                if (isSelected) {
                                                  setNewCatScheduleDays(newCatScheduleDays.filter(d => d !== day.val));
                                                } else {
                                                  setNewCatScheduleDays([...newCatScheduleDays, day.val].sort());
                                                }
                                              }}
                                              style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                background: isSelected ? '#0a84ff' : 'rgba(0,0,0,0.2)',
                                                color: 'white',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                              }}
                                            >
                                              {day.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                      <div>
                                        <label className="input-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Kezdés</label>
                                        <input 
                                          type="time" 
                                          className="input-field" 
                                          style={{ height: '36px', fontSize: '13px' }}
                                          value={newCatScheduleFrom}
                                          onChange={e => setNewCatScheduleFrom(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <label className="input-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Vége</label>
                                        <input 
                                          type="time" 
                                          className="input-field" 
                                          style={{ height: '36px', fontSize: '13px' }}
                                          value={newCatScheduleTo}
                                          onChange={e => setNewCatScheduleTo(e.target.value)}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Column B: Courses Editor */}
                                  <div style={{ 
                                    background: 'rgba(255, 255, 255, 0.01)', 
                                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                                    borderRadius: '12px', 
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    maxHeight: '450px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#30d158', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Layers size={18} /> Fogások Konfigurációja ({newCatCourses.length} db)
                                      </span>
                                      <button
                                        type="button"
                                        className="btn"
                                        style={{ padding: '6px 12px', fontSize: '11px', background: '#0a84ff', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => {
                                          const nextId = newCatCourses.length > 0 ? Math.max(...newCatCourses.map(c => c.id)) + 1 : 1;
                                          setNewCatCourses([...newCatCourses, {
                                            id: nextId,
                                            name: `${newCatCourses.length + 1}. Fogás`,
                                            sourceType: 'individual',
                                            itemIds: [],
                                            itemOverrides: {}
                                          }]);
                                        }}
                                      >
                                        + Új Fogás
                                      </button>
                                    </div>

                                    {newCatCourses.length === 0 ? (
                                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px' }}>
                                        Még nincsenek fogások hozzáadva.
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {newCatCourses.map((course) => {
                                          let courseItems: MenuItem[] = [];
                                          if (course.sourceType === 'category' && course.sourceCategoryId) {
                                            courseItems = db.items.filter((i: any) => i.category_id === course.sourceCategoryId && i.is_active !== false);
                                          } else if (course.sourceType === 'individual' && course.itemIds) {
                                            courseItems = db.items.filter((i: any) => course.itemIds?.includes(i.id) && i.is_active !== false);
                                          }

                                          return (
                                            <div key={course.id} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <input 
                                                  type="text"
                                                  className="input-field"
                                                  style={{ height: '32px', width: '60%', fontSize: '13px', fontWeight: 'bold', padding: '0 8px', borderRadius: '6px' }}
                                                  value={course.name}
                                                  onChange={e => {
                                                    const val = e.target.value;
                                                    setNewCatCourses(newCatCourses.map(c => c.id === course.id ? { ...c, name: val } : c));
                                                  }}
                                                />
                                                <button
                                                  type="button"
                                                  className="btn"
                                                  style={{ padding: '6px 12px', fontSize: '11px', background: 'rgba(255,69,58,0.12)', color: '#ff453a', border: '1px solid rgba(255,69,58,0.2)', borderRadius: '8px', cursor: 'pointer' }}
                                                  onClick={() => {
                                                    setNewCatCourses(newCatCourses.filter(c => c.id !== course.id));
                                                  }}
                                                >
                                                  Töröl
                                                </button>
                                              </div>

                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                <div>
                                                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Forrás típusa</label>
                                                  <select
                                                    className="input-field"
                                                    style={{ height: '32px', fontSize: '12px', padding: '0 4px', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                                                    value={course.sourceType}
                                                    onChange={e => {
                                                      const type = e.target.value as 'category' | 'individual';
                                                      setNewCatCourses(newCatCourses.map(c => c.id === course.id ? { ...c, sourceType: type, sourceCategoryId: null, itemIds: [], itemOverrides: {} } : c));
                                                    }}
                                                  >
                                                    <option value="individual">Egyedi ételek</option>
                                                    <option value="category">Teljes kategória</option>
                                                  </select>
                                                </div>

                                                {course.sourceType === 'category' ? (
                                                  <div>
                                                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Kategória</label>
                                                    <select
                                                      className="input-field"
                                                      style={{ height: '32px', fontSize: '12px', padding: '0 4px', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                                                      value={course.sourceCategoryId || ''}
                                                      onChange={e => {
                                                        const catId = Number(e.target.value) || null;
                                                        setNewCatCourses(newCatCourses.map(c => c.id === course.id ? { ...c, sourceCategoryId: catId, itemOverrides: {} } : c));
                                                      }}
                                                    >
                                                      <option value="">-- Válassz --</option>
                                                      {db.categories.filter((c: any) => c.id !== editingCategory.id && !c.is_menu_category).map((c: any) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                      ))}
                                                    </select>
                                                  </div>
                                                ) : (
                                                  <div>
                                                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Ételek</label>
                                                    <div style={{ maxHeight: '90px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', padding: '6px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)' }}>
                                                      {db.items.map((item: any) => {
                                                        const isChecked = course.itemIds?.includes(item.id);
                                                        return (
                                                          <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'white', margin: '3px 0' }}>
                                                            <input 
                                                              type="checkbox"
                                                              checked={isChecked}
                                                              onChange={() => {
                                                                const updatedIds = isChecked 
                                                                  ? (course.itemIds || []).filter(id => id !== item.id)
                                                                  : [...(course.itemIds || []), item.id];
                                                                
                                                                const updatedOverrides = { ...(course.itemOverrides || {}) };
                                                                if (isChecked) {
                                                                  delete updatedOverrides[item.id];
                                                                }

                                                                setNewCatCourses(newCatCourses.map(c => c.id === course.id ? { ...c, itemIds: updatedIds, itemOverrides: updatedOverrides } : c));
                                                              }}
                                                            />
                                                            {item.name}
                                                          </label>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>

                                              {courseItems.length > 0 && (
                                                <div style={{ marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                                                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0a84ff' }}>
                                                    Ételek felülírásai:
                                                  </span>
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                                    {courseItems.map((item) => {
                                                      const override = course.itemOverrides?.[item.id] || { price: item.price, ingredients: item.ingredients || [] };
                                                      
                                                      return (
                                                        <div key={item.id} style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{item.name}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                              <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Ár (FT):</label>
                                                              <input 
                                                                type="number"
                                                                className="input-field"
                                                                style={{ height: '26px', width: '70px', fontSize: '11px', padding: '0 6px', borderRadius: '4px' }}
                                                                value={override.price}
                                                                onChange={e => {
                                                                  const price = parseInt(e.target.value) || 0;
                                                                  const updatedOverrides = {
                                                                    ...(course.itemOverrides || {}),
                                                                    [item.id]: {
                                                                      ...override,
                                                                      price
                                                                    }
                                                                  };
                                                                  setNewCatCourses(newCatCourses.map(c => c.id === course.id ? { ...c, itemOverrides: updatedOverrides } : c));
                                                                }}
                                                              />
                                                            </div>
                                                          </div>

                                                          {override.ingredients && override.ingredients.length > 0 && (
                                                            <div style={{ marginTop: '6px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                                {override.ingredients.map((ing, ingIdx) => {
                                                                  const inv = db.inventory.find((i: any) => i.id === ing.ingredientId);
                                                                  return (
                                                                    <div key={ing.ingredientId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={inv ? inv.name : ''}>
                                                                        {inv ? inv.name : `Alapanyag #${ing.ingredientId}`}
                                                                      </span>
                                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                        <input 
                                                                          type="number"
                                                                          className="input-field"
                                                                          style={{ height: '22px', width: '50px', fontSize: '10px', padding: '2px', borderRadius: '4px' }}
                                                                          step="any"
                                                                          value={ing.quantity}
                                                                          onChange={e => {
                                                                            const qty = parseFloat(e.target.value) || 0;
                                                                            const updatedIngs = override.ingredients.map((ig, igx) => igx === ingIdx ? { ...ig, quantity: qty } : ig);
                                                                            const updatedOverrides = {
                                                                              ...(course.itemOverrides || {}),
                                                                              [item.id]: {
                                                                                ...override,
                                                                                ingredients: updatedIngs
                                                                              }
                                                                            };
                                                                            setNewCatCourses(newCatCourses.map(c => c.id === course.id ? { ...c, itemOverrides: updatedOverrides } : c));
                                                                          }}
                                                                        />
                                                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{inv?.unit || ''}</span>
                                                                      </div>
                                                                    </div>
                                                                  );
                                                                })}
                                                              </div>
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                        </div>

                        {/* Modal Footer */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--glass-border)' }}>
                          <button 
                            type="button"
                            className="btn" 
                            style={{ padding: '10px 28px', borderRadius: '20px', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '13px' }}
                            onClick={() => setEditingCategory(null)}
                          >
                            Mégse
                          </button>
                          <button 
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '10px 28px', borderRadius: '20px', fontWeight: 600, background: '#0a84ff', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(10,132,255,0.3)', fontSize: '13px' }}
                            onClick={() => {
                              const nameTrimmed = newCatName.trim();
                              if (!nameTrimmed) return;

                              const promoObj = {
                                isEnabled: promoIsEnabled,
                                type: promoType,
                                onceDate: promoType === 'once' ? promoOnceDate : undefined,
                                recurringDays: promoType === 'recurring' ? promoRecurringDays : undefined,
                                recurringWeeksInterval: promoType === 'recurring' ? promoRecurringWeeksInterval : undefined,
                                recurringStartDate: promoType === 'recurring' && promoRecurringWeeksInterval > 1 ? promoRecurringStartDate : undefined,
                                priceAdjustmentType: 'percent' as const,
                                priceAdjustmentValue: Number(promoPriceAdjustmentValue) || 0,
                                packagingFeePolicy: promoPackagingFeePolicy
                              };

                              const menuSched = newCatIsMenuCategory ? {
                                days: newCatScheduleDays,
                                fromTime: newCatScheduleFrom || undefined,
                                toTime: newCatScheduleTo || undefined
                              } : undefined;

                              let updated = [...db.categories];
                              if (editingCategory.id === 0) {
                                const newId = db.categories.length > 0 ? Math.max(...db.categories.map((c: any) => c.id)) + 1 : 1;
                                updated.push({
                                  id: newId,
                                  name: nameTrimmed,
                                  description: newCatDescription.trim(),
                                  is_active: true,
                                  linked_category_id: newCatIsMenuCategory ? null : (newCatLinkedCategoryId === 'none' ? null : newCatLinkedCategoryId),
                                  include_linked_packaging_fee: newCatIsMenuCategory ? false : (newCatLinkedCategoryId === 'none' ? false : newCatIncludeLinkedPackagingFee),
                                  promotion: promoObj,
                                  is_menu_category: newCatIsMenuCategory,
                                  courses: newCatIsMenuCategory ? newCatCourses : undefined,
                                  menu_schedule: menuSched
                                });
                              } else {
                                updated = db.categories.map((c: any) => c.id === editingCategory.id ? {
                                  ...c,
                                  name: nameTrimmed,
                                  description: newCatDescription.trim(),
                                  linked_category_id: newCatIsMenuCategory ? null : (newCatLinkedCategoryId === 'none' ? null : newCatLinkedCategoryId),
                                  include_linked_packaging_fee: newCatIsMenuCategory ? false : (newCatLinkedCategoryId === 'none' ? false : newCatIncludeLinkedPackagingFee),
                                  promotion: promoObj,
                                  is_menu_category: newCatIsMenuCategory,
                                  courses: newCatIsMenuCategory ? newCatCourses : undefined,
                                  menu_schedule: menuSched
                                } : c);
                              }

                              saveDatabase({ ...db, categories: updated });
                              setEditingCategory(null);
                            }}
                          >
                            Mentés
                          </button>
                        </div>

                      </div>
                    </div>
                  )}
                  {/* Sliding Container for Tables (smooth horizontal switch) */}
                  <div style={{ overflow: 'hidden', width: '100%', borderRadius: 'var(--radius-md)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ 
                      display: 'flex', 
                      width: '200%', 
                      flex: 1,
                      minHeight: 0,
                      transform: menuSubTab === 'items' ? 'translateX(0%)' : 'translateX(-50%)', 
                      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
                    }}>
                      {/* Left Slide: Ételcikkek table */}
                      <div style={{ width: '50%', flexShrink: 0, paddingRight: '12px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                        
                        {/* Filter panel card (placed inside the left slide so it only pushes this table down) */}
                        <div className={`admin-filter-panel ${showFilterPanel ? 'show' : ''}`}>
                          <div className="filter-grid">
                            
                            {/* 1. Status Filter */}
                            <div className="filter-group">
                              <label className="filter-label">Állapot</label>
                              <AppleSelect
                                value={filterStatus}
                                onChange={setFilterStatus}
                                options={[
                                  { value: 'all', label: 'Mindegyik' },
                                  { value: 'active', label: 'Csak aktív' },
                                  { value: 'inactive', label: 'Csak kikapcsolt' }
                                ]}
                                icon={<Activity size={14} />}
                                isOpen={openDropdown === 'status'}
                                onToggle={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                                onClose={() => setOpenDropdown(null)}
                              />
                            </div>

                            {/* 2. Category Filter */}
                            <div className="filter-group">
                              <label className="filter-label">Kategória</label>
                              <AppleSelect
                                value={filterCategory}
                                onChange={setFilterCategory}
                                options={[
                                  { value: 'all', label: 'Összes kategória' },
                                  ...db.categories.map((c: any) => ({ value: c.id, label: c.name }))
                                ]}
                                icon={<Layers size={14} />}
                                isOpen={openDropdown === 'category'}
                                onToggle={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
                                onClose={() => setOpenDropdown(null)}
                              />
                            </div>

                            {/* 3. Price Filter */}
                            <div className="filter-group">
                              <label className="filter-label">Árkategória (Min - Max)</label>
                              <div className="apple-filter-price-range">
                                <div className="apple-filter-wrapper" style={{ flex: 1 }}>
                                  <span className="apple-filter-icon"><Banknote size={14} /></span>
                                  <input 
                                    type="number" 
                                    className="apple-filter-input"
                                    placeholder="Min"
                                    value={filterMinPrice}
                                    onChange={e => setFilterMinPrice(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                  />
                                </div>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>-</span>
                                <div className="apple-filter-wrapper" style={{ flex: 1 }}>
                                  <span className="apple-filter-icon"><Banknote size={14} /></span>
                                  <input 
                                    type="number" 
                                    className="apple-filter-input"
                                    placeholder="Max"
                                    value={filterMaxPrice}
                                    onChange={e => setFilterMaxPrice(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 4. Packaging Type Filter */}
                            <div className="filter-group">
                              <label className="filter-label">Csomagolás</label>
                              <AppleSelect
                                value={filterPackType}
                                onChange={setFilterPackType}
                                options={[
                                  { value: 'all', label: 'Összes csomagolás' },
                                  { value: 'none', label: 'Nincs csomagolás' },
                                  ...Object.keys(db.packagingFees).map(key => ({
                                    value: key,
                                    label: key === 'pizza' ? 'Pizza doboz' : key === 'box' ? 'Elviteles doboz' : key === 'cup' ? 'Pohár' : key
                                  }))
                                ]}
                                icon={<Package size={14} />}
                                isOpen={openDropdown === 'pack'}
                                onToggle={() => setOpenDropdown(openDropdown === 'pack' ? null : 'pack')}
                                onClose={() => setOpenDropdown(null)}
                              />
                            </div>

                            {/* 5. Allergen Filter */}
                            <div className="filter-group">
                              <label className="filter-label">Allergének</label>
                              <AppleSelect
                                value={filterAllergen}
                                onChange={setFilterAllergen}
                                options={[
                                  { value: 'all', label: 'Mindegyik (Vagy nincs)' },
                                  ...ALLERGEN_RULES.map(rule => ({
                                    value: rule.code,
                                    label: `(${rule.code}) ${rule.name}`
                                  }))
                                ]}
                                icon={<AlertTriangle size={14} />}
                                isOpen={openDropdown === 'allergen'}
                                onToggle={() => setOpenDropdown(openDropdown === 'allergen' ? null : 'allergen')}
                                onClose={() => setOpenDropdown(null)}
                              />
                            </div>

                          </div>

                          {/* Reset button inside filter card */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                            <button 
                              className="btn"
                              style={{ fontSize: '11px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}
                              onClick={() => {
                                setFilterStatus('all');
                                setFilterCategory('all');
                                setFilterMinPrice('');
                                setFilterMaxPrice('');
                                setFilterPackType('all');
                                setFilterAllergen('all');
                              }}
                            >
                              Szűrők alaphelyzetbe
                            </button>
                          </div>
                        </div>
                        
                        <div className="table-container" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '10px' }}>
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Étel név</th>
                                <th>Kategória</th>
                                <th>Ár</th>
                                <th>Csomagolás</th>
                                <th>Láthatóság</th>
                                <th style={{ textAlign: 'right' }}>Műveletek</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const filteredItems = db.items.filter((item: MenuItem) => {
                                  if (filterStatus === 'active' && item.is_active === false) return false;
                                  if (filterStatus === 'inactive' && item.is_active !== false) return false;
                                  if (filterCategory !== 'all' && item.category_id !== filterCategory) return false;
                                  if (filterMinPrice !== '' && item.price < filterMinPrice) return false;
                                  if (filterMaxPrice !== '' && item.price > filterMaxPrice) return false;
                                  if (filterPackType !== 'all') {
                                    if (filterPackType === 'none' && item.packaging_type && item.packaging_type !== 'none') return false;
                                    if (filterPackType !== 'none' && item.packaging_type !== filterPackType) return false;
                                  }
                                  if (filterAllergen !== 'all' && (!item.allergens || !item.allergens.includes(filterAllergen))) return false;
                                  return true;
                                });

                                if (filteredItems.length === 0) {
                                  return (
                                    <tr>
                                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                        Nincs a megadott feltételeknek megfelelő ételcikk.
                                      </td>
                                    </tr>
                                  );
                                }

                                return filteredItems.map((item: MenuItem) => {
                                  const cat = db.categories.find((c: any) => c.id === item.category_id);
                                  const isCatHidden = cat && cat.is_active === false;
                                  const isHidden = item.is_active === false;
                                  const isRowFaded = isHidden || isCatHidden;

                                  return (
                                  <tr key={item.id} style={{ opacity: isRowFaded ? 0.4 : 1, transition: 'opacity 0.2s ease' }}>
                                    <td>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <strong style={{ color: 'white' }}>{item.name}</strong>
                                        {item.description && (
                                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.description}</span>
                                        )}
                                        {item.allergens && item.allergens.length > 0 && (
                                          <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                            {item.allergens.map((code: string) => {
                                              const rule = ALLERGEN_RULES.find(r => r.code === code);
                                              return (
                                                <span 
                                                  key={code} 
                                                  style={{ background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)', color: '#ff9f0a', fontSize: '9px', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}
                                                  title={rule?.name}
                                                >
                                                  {code}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      {cat?.name || 'Ismeretlen'}
                                      {isCatHidden && <span style={{ display: 'block', fontSize: '10px', color: 'var(--danger)', fontWeight: 500 }}>(Rejtett kategória)</span>}
                                    </td>
                                    <td>{item.price.toLocaleString()} FT</td>
                                    <td>
                                      {item.packaging_fee > 0 ? `${item.packaging_fee} FT` : 'Ingyenes'}
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                                        {item.packaging_type === 'pizza' ? 'Pizza doboz' : item.packaging_type === 'box' ? 'Elviteles doboz' : item.packaging_type === 'cup' ? 'Pohár' : 'Egyedi'}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        onClick={() => {
                                          const updated = db.items.map((i: any) => i.id === item.id ? { ...i, is_active: isHidden } : i);
                                          saveDatabase({ ...db, items: updated });
                                        }}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: isHidden ? 'var(--text-secondary)' : '#30d158', outline: 'none' }}
                                        title={isHidden ? "Étel megjelenítése a főmenün" : "Étel elrejtése a főmenün"}
                                      >
                                        {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                                        <span style={{ fontWeight: 600, fontSize: '11px' }}>{isHidden ? "Kikapcsolva" : "Aktív"}</span>
                                      </button>
                                    </td>
                                    <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                                      <button 
                                        className="btn" 
                                        style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', marginRight: '6px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}
                                        onClick={() => {
                                          setEditingItem(item);
                                          setNewItemName(item.name);
                                          setNewItemPrice(item.price);
                                          setNewItemPackFee(item.packaging_fee);
                                          setNewItemPackType(item.packaging_type || 'none');
                                          setNewItemCatId(item.category_id);
                                          setNewItemDescription(item.description || '');
                                          setNewItemIngredients(item.ingredients || []);
                                          if (db.inventory.length > 0) {
                                            setSelectedAddIngredientId(db.inventory[0].id);
                                            setSelectedAddIngredientQty(1);
                                          } else {
                                            setSelectedAddIngredientId(null);
                                            setSelectedAddIngredientQty(0);
                                          }
                                        }}
                                      >
                                        Szerkesztés
                                      </button>
                                      <button 
                                        className="btn" 
                                        style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(255,69,58,0.12)', color: '#ff453a', border: '1px solid rgba(255,69,58,0.25)', borderRadius: '20px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}
                                        onClick={() => {
                                          customConfirm(`Biztosan törlöd a(z) "${item.name}" ételt?`, () => {
                                            const updated = db.items.filter((i: any) => i.id !== item.id);
                                            saveDatabase({ ...db, items: updated });
                                          });
                                        }}
                                      >
                                        Törlés
                                      </button>
                                    </td>
                                  </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right Slide: Kategóriák table */}
                      <div style={{ width: '50%', flexShrink: 0, paddingLeft: '12px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                        <div className="table-container" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '10px' }}>
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Kategória név</th>
                                <th>Leírás</th>
                                <th>Láthatóság</th>
                                <th style={{ textAlign: 'right' }}>Műveletek</th>
                              </tr>
                            </thead>
                            <tbody>
                              {db.categories.map((cat: Category) => {
                                const isHidden = cat.is_active === false;
                                return (
                                  <tr key={cat.id} style={{ opacity: isHidden ? 0.5 : 1, transition: 'all 0.2s ease' }}>
                                    <td style={{ fontWeight: 600 }}>#{cat.id}</td>
                                    <td style={{ fontWeight: 700, color: 'white' }}>{cat.name}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{cat.description || 'Nincs leírás megadva'}</td>
                                    <td>
                                      <button
                                        onClick={() => {
                                          const updated = db.categories.map((c: any) => c.id === cat.id ? { ...c, is_active: isHidden } : c);
                                          saveDatabase({ ...db, categories: updated });
                                        }}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: isHidden ? 'var(--text-secondary)' : '#30d158', outline: 'none' }}
                                        title={isHidden ? "Kategória megjelenítése a főmenün" : "Kategória elrejtése a főmenün"}
                                      >
                                        {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                                        <span style={{ fontWeight: 600, fontSize: '12px' }}>{isHidden ? "Kikapcsolva" : "Aktív"}</span>
                                      </button>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button 
                                        className="btn" 
                                        style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', marginRight: '6px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}
                                        onClick={() => {
                                          setEditingCategory(cat);
                                          setEditingCategoryTab('general');
                                          setNewCatName(cat.name);
                                          setNewCatDescription(cat.description || '');
                                          setNewCatLinkedCategoryId(cat.linked_category_id !== undefined && cat.linked_category_id !== null ? cat.linked_category_id : 'none');
                                          setNewCatIncludeLinkedPackagingFee(cat.include_linked_packaging_fee || false);
                                        }}
                                      >
                                        Szerkesztés
                                      </button>
                                      <button 
                                        className="btn" 
                                        style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(255,69,58,0.12)', color: '#ff453a', border: '1px solid rgba(255,69,58,0.25)', borderRadius: '20px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }}
                                        onClick={() => {
                                          customConfirm(`Biztosan törlöd a(z) "${cat.name}" kategóriát? A benne lévő ételek kategória nélkül maradnak.`, () => {
                                            const updated = db.categories.filter((c: any) => c.id !== cat.id);
                                            saveDatabase({ ...db, categories: updated });
                                          });
                                        }}
                                      >
                                        Törlés
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: PACKAGING FEES */}
              {adminTab === 'packaging' && (
                <>
                  <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 className="admin-title">Csomagolási díjak beállítása</h2>
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        setEditingPackKey('');
                        setNewPackName('');
                        setNewPackPrice(100);
                      }}
                    >
                      <Plus size={16} /> Új csomagolási díj hozzáadása
                    </button>
                  </div>

                  {/* Calendar-style grid of packaging options */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginTop: '10px' }}>
                    {Object.keys(db.packagingFees).map((key) => {
                      const price = db.packagingFees[key];
                      const count = db.items.filter((item: any) => item.packaging_type === key).length;
                      const percentage = db.items.length > 0 ? Math.round((count / db.items.length) * 100) : 0;
                      
                      // User-friendly names
                      const displayName = key === 'pizza' ? 'Pizza doboz' : key === 'box' ? 'Elviteles doboz' : key === 'cup' ? 'Pohár' : key;

                      return (
                        <div 
                          key={key} 
                          className="admin-card" 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            justifyContent: 'space-between', 
                            gap: '14px', 
                            padding: '16px', 
                            background: 'var(--panel-bg)', 
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)',
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              Azonosító: {key}
                            </span>
                            <span style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>
                              {displayName}
                            </span>
                            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                              {price.toLocaleString()} FT
                            </span>
                          </div>

                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <span>Használat étlapon:</span>
                              <strong style={{ color: 'white' }}>{count} tétel ({percentage}%)</strong>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <button 
                                className="btn" 
                                style={{ flex: 1, padding: '6px 0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                onClick={() => {
                                  setEditingPackKey(key);
                                  setNewPackName(key);
                                  setNewPackPrice(price);
                                }}
                              >
                                Szerkeszt
                              </button>
                              <button 
                                className="btn btn-danger" 
                                style={{ flex: 1, padding: '6px 0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                        onClick={() => {
                                          customConfirm(`Biztosan törlöd a(z) "${displayName}" csomagolást? A hozzá tartozó ételek csomagolása ingyenesre áll át.`, () => {
                                            const updatedFees = { ...db.packagingFees };
                                            delete updatedFees[key];
                                            const updatedItems = db.items.map((item: any) => {
                                              if (item.packaging_type === key) {
                                                return { ...item, packaging_type: 'none', packaging_fee: 0 };
                                              }
                                              return item;
                                            });
                                            saveDatabase({ ...db, packagingFees: updatedFees, items: updatedItems });
                                          });
                                        }}
                              >
                                Töröl
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add / Edit Packaging Modal Overlay */}
                  {editingPackKey !== null && (
                    <div className="modal-overlay" onClick={() => setEditingPackKey(null)}>
                      <div className="modal-card" style={{ maxWidth: '400px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <span className="modal-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                            {editingPackKey === '' ? 'Új csomagolás hozzáadása' : 'Csomagolás szerkesztése'}
                          </span>
                          <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditingPackKey(null)}>
                            <X size={16} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label className="input-label">Azonosító név</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              value={newPackName}
                              onChange={e => setNewPackName(e.target.value)}
                              disabled={editingPackKey !== ''}
                              placeholder="pl: doboz, pohar, pizza"
                            />
                          </div>
                          <div>
                            <label className="input-label">Ár (FT)</label>
                            <input 
                              type="number" 
                              className="input-field" 
                              value={newPackPrice}
                              onChange={e => setNewPackPrice(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button className="btn" onClick={() => setEditingPackKey(null)}>Mégse</button>
                            <button 
                              className="btn btn-primary"
                              onClick={() => {
                                const nameTrimmed = newPackName.trim().toLowerCase();
                                if (!nameTrimmed) return;

                                const finalPrice = Number(newPackPrice) || 0;
                                const updatedFees = { ...db.packagingFees };
                                if (editingPackKey === '') {
                                  // Add new key
                                  updatedFees[nameTrimmed] = finalPrice;
                                } else {
                                  // Update price
                                  updatedFees[editingPackKey] = finalPrice;
                                  
                                  // Also update any menu items using this packaging type to sync their packaging_fee
                                  const updatedItems = db.items.map((item: any) => {
                                    if (item.packaging_type === editingPackKey) {
                                      return { ...item, packaging_fee: finalPrice };
                                    }
                                    return item;
                                  });
                                  db.items = updatedItems; // sync in state
                                }

                                saveDatabase({ ...db, packagingFees: updatedFees });
                                setEditingPackKey(null);
                              }}
                            >
                              Mentés
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  <div className="alert-box" style={{ display: 'flex', gap: '8px', padding: '12px', background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--warning)', marginTop: '20px', maxWidth: '600px' }}>
                    <AlertTriangle size={18} />
                    <span>A csomagolási díjak módosítása azonnal alkalmazásra kerül a hozzájuk kapcsolt ételekre és az újonnan kosárba helyezett termékekre.</span>
                  </div>
                </>
              )}

              {/* TAB: INVENTORY */}
              {adminTab === 'inventory' && (() => {
                const invCategories = db.inventoryCategories || [];
                const suppliers = db.suppliers || [];
                const inventory = db.inventory || [];
                
                // Helper to format date
                const formatDate = (isoStr: string | undefined): string => {
                  if (!isoStr) return 'Soha';
                  const d = new Date(isoStr);
                  if (isNaN(d.getTime())) return 'Soha';
                  return d.toLocaleDateString('hu-HU') + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                };

                // Helper to calculate next fill expected date
                const calculateNextFill = (lastFilled: string | undefined, freq: string): string => {
                  if (!lastFilled) return 'Nincs feltöltési adat';
                  const date = new Date(lastFilled);
                  if (isNaN(date.getTime())) return 'Nincs feltöltési adat';
                  
                  let days = 7; // Default fallback
                  const numMatch = freq.match(/(\d+)/);
                  if (numMatch) {
                    const val = parseInt(numMatch[1]);
                    if (freq.toLowerCase().includes('hét') || freq.toLowerCase().includes('hetente')) {
                      days = val * 7;
                    } else {
                      days = val;
                    }
                  }
                  date.setDate(date.getDate() + days);
                  return date.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }) + '.';
                };

                // Helper to get status badge
                const getInventoryStatusBadge = (inv: any) => {
                  if (inv.is_under_procurement || inv.status === 'Beszerzés alatt') {
                    return (
                      <span className="order-status pending" style={{ backgroundColor: 'rgba(10, 132, 255, 0.15)', border: '1px solid rgba(10, 132, 255, 0.3)', color: '#0a84ff' }}>
                        Beszerzés alatt
                      </span>
                    );
                  }
                  if (inv.quantity <= 0) {
                    return <span className="order-status cancelled">Elfogyott</span>;
                  }
                  if (inv.quantity <= inv.warning_limit) {
                    return <span className="order-status pending">Alacsony készlet</span>;
                  }
                  return <span className="order-status completed">Rendben</span>;
                };

                return (
                  <>
                    {/* Unified Header matching Étlap szerkesztése exactly (separating line at the very bottom of the entire block) */}
                    <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <h2 className="admin-title" style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: 0 }}>Raktár & Készlet szerkesztése</h2>
                        
                        {/* Segmented Control Switcher (Pill style container matching menu editor) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="menu-sliding-toggle-container" style={{ height: '38px', alignItems: 'center' }}>
                            <div 
                              className="menu-sliding-toggle-indicator" 
                              style={{
                                position: 'absolute',
                                top: '4px',
                                bottom: '4px',
                                borderRadius: '25px',
                                transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                                zIndex: 1,
                                ...(inventorySubTab === 'items' ? {
                                  left: '4px',
                                  width: '120px',
                                  background: 'linear-gradient(135deg, #0071e3, #5ac8fa)',
                                  boxShadow: '0 0 12px rgba(0, 113, 227, 0.45)'
                                } : inventorySubTab === 'categories' ? {
                                  left: '128px',
                                  width: '110px',
                                  background: 'linear-gradient(135deg, #bf5af2, #af52de)',
                                  boxShadow: '0 0 12px rgba(191, 90, 242, 0.45)'
                                } : {
                                  left: '242px',
                                  width: '160px',
                                  background: 'linear-gradient(135deg, #ffcc00, #ff9f0a)',
                                  boxShadow: '0 0 12px rgba(255, 204, 0, 0.45)'
                                })
                              }}
                            />
                            <button
                              className={`menu-sliding-toggle-btn ${inventorySubTab === 'items' ? 'active' : ''}`}
                              style={{ width: '120px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                              onClick={() => setInventorySubTab('items')}
                            >
                              Raktárcikkek
                            </button>
                            <button
                              className={`menu-sliding-toggle-btn ${inventorySubTab === 'categories' ? 'active' : ''}`}
                              style={{ width: '110px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                              onClick={() => setInventorySubTab('categories')}
                            >
                              Kategóriák
                            </button>
                            <button
                              className={`menu-sliding-toggle-btn ${inventorySubTab === 'suppliers' ? 'active suppliers-active' : ''}`}
                              style={{ width: '160px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                              onClick={() => setInventorySubTab('suppliers')}
                            >
                              Beszerzési helyek
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Sliding Action Buttons for Warehouse (aligned and matching height of 38px) */}
                      <div style={{ position: 'relative', height: '38px', width: '260px' }}>
                        <button 
                          className="btn btn-warehouse-add-items" 
                          style={{ 
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            height: '38px',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            padding: '0 14px', 
                            fontSize: '13px', 
                            borderRadius: 'var(--radius-md)', 
                            fontWeight: 600, 
                            border: 'none', 
                            cursor: 'pointer',
                            transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                            opacity: inventorySubTab === 'items' ? 1 : 0,
                            transform: inventorySubTab === 'items' ? 'translateX(0)' : 'translateX(20px)',
                            pointerEvents: inventorySubTab === 'items' ? 'auto' : 'none'
                          }}
                          onClick={() => {
                            setInvItemName('');
                            setInvItemCategoryId('none');
                            setInvItemQuantity(0);
                            setInvItemUnit('kg');
                            setInvItemWarningLimit(0);
                            setInvItemSupplierId(suppliers[0]?.id || '');
                            setInvItemFreqValue(7);
                            setInvItemFreqUnit('day');
                            setInvItemProcurement(false);
                            setInvItemDoubleExtraPrice(0);
                            setEditingInvItem({ id: 'NEW', quantity: 0 });
                          }}
                        >
                          <Plus size={16} /> Új raktárcikk hozzáadása
                        </button>

                        <button 
                          className="btn btn-warehouse-add-categories" 
                          style={{ 
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            height: '38px',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            padding: '0 14px', 
                            fontSize: '13px', 
                            borderRadius: 'var(--radius-md)', 
                            fontWeight: 600, 
                            border: 'none', 
                            cursor: 'pointer',
                            transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                            opacity: inventorySubTab === 'categories' ? 1 : 0,
                            transform: inventorySubTab === 'categories' ? 'translateX(0)' : inventorySubTab === 'items' ? 'translateX(-20px)' : 'translateX(20px)',
                            pointerEvents: inventorySubTab === 'categories' ? 'auto' : 'none'
                          }}
                          onClick={() => {
                            setInvCatName('');
                            setInvCatDescription('');
                            setEditingInvCat({ id: 'NEW' });
                          }}
                        >
                          <Plus size={16} /> Új kategória hozzáadása
                        </button>

                        <button 
                          className="btn btn-warehouse-add-suppliers" 
                          style={{ 
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            height: '38px',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            padding: '0 14px', 
                            fontSize: '13px', 
                            borderRadius: 'var(--radius-md)', 
                            fontWeight: 600, 
                            border: 'none', 
                            cursor: 'pointer',
                            transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                            opacity: inventorySubTab === 'suppliers' ? 1 : 0,
                            transform: inventorySubTab === 'suppliers' ? 'translateX(0)' : 'translateX(-20px)',
                            pointerEvents: inventorySubTab === 'suppliers' ? 'auto' : 'none'
                          }}
                          onClick={() => {
                            setSupplierName('');
                            setSupplierAddress('');
                            setSupplierDescription('');
                            setEditingSupplier({ id: 'NEW' });
                          }}
                        >
                          <Plus size={16} /> Új Beszerzési hely
                        </button>
                      </div>
                    </div>

                    {/* Sliding Container for Tables (smooth horizontal switch for 3 tabs) */}
                    <div style={{ overflow: 'hidden', width: '100%', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ 
                        display: 'flex', 
                        width: '300%', 
                        transform: inventorySubTab === 'items' ? 'translateX(0%)' : inventorySubTab === 'categories' ? 'translateX(-33.333%)' : 'translateX(-66.666%)', 
                        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
                      }}>
                        {/* Left Slide: Raktárcikkek table */}
                        <div style={{ width: '33.333%', flexShrink: 0, paddingRight: '12px' }}>
                          <div className="table-container" style={{ maxHeight: 'calc(100vh - 310px)', overflowY: 'auto', paddingBottom: '10px' }}>
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Kategória</th>
                                  <th>Raktárcikk Név</th>
                                  <th>Elérhető Mennyiség</th>
                                  <th>Figyelmeztetési limit</th>
                                  <th>Státusz</th>
                                  <th>Beszerzési hely</th>
                                  <th>Láthatóság</th>
                                  <th style={{ textAlign: 'right' }}>Műveletek</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inventory.map((inv: any) => {
                                  const category = invCategories.find((c: any) => c.id === inv.category_id);
                                  const supplier = suppliers.find((s: any) => s.id === inv.supplier_id);
                                  const isInactive = inv.is_active === false;
                                  
                                  return (
                                    <tr key={inv.id} style={{ opacity: isInactive ? 0.45 : 1, transition: 'opacity 0.2s ease' }}>
                                      <td style={{ color: 'var(--text-secondary)' }}>{category ? category.name : 'Nincs kategória'}</td>
                                      <td style={{ fontWeight: 600 }}>{inv.name}</td>
                                      <td style={{ fontWeight: 700 }}>{inv.quantity} {inv.unit || 'kg'}</td>
                                      <td>{inv.warning_limit} {inv.unit || 'kg'}</td>
                                      <td>{getInventoryStatusBadge(inv)}</td>
                                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{supplier ? supplier.name : '-'}</td>
                                      <td>
                                        <button 
                                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                          onClick={() => {
                                            const updated = inventory.map((i: any) => 
                                              i.id === inv.id ? { ...i, is_active: i.is_active === false ? true : false } : i
                                            );
                                            saveDatabase({ ...db, inventory: updated });
                                          }}
                                        >
                                          {isInactive ? (
                                            <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                              <EyeOff size={14} /> Rejtett
                                            </span>
                                          ) : (
                                            <span style={{ color: '#30d158', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                                              <Eye size={14} /> Aktív
                                            </span>
                                          )}
                                        </button>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                                          <button 
                                            className="btn" 
                                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '14px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => {
                                              setInvItemName(inv.name);
                                              setInvItemCategoryId(inv.category_id || 'none');
                                              setInvItemQuantity(inv.quantity);
                                              setInvItemUnit(inv.unit || 'kg');
                                              setInvItemWarningLimit(inv.warning_limit);
                                              setInvItemSupplierId(inv.supplier_id || '');
                                              
                                              // Parse frequency
                                              const freqVal = parseInt(inv.purchase_frequency) || 7;
                                              const isWeeks = inv.purchase_frequency.includes('hét') || inv.purchase_frequency.includes('hetente');
                                              setInvItemFreqValue(freqVal);
                                              setInvItemFreqUnit(isWeeks ? 'week' : 'day');
                                              setInvItemProcurement(inv.is_under_procurement || false);
                                              setInvItemDoubleExtraPrice(inv.double_extra_price || 0);
                                              
                                              setEditingInvItem(inv);
                                            }}
                                          >
                                            Szerkeszt
                                          </button>
                                          <button 
                                            className="btn btn-danger" 
                                            style={{ background: '#ff453a', border: 'none', color: 'white', borderRadius: '14px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 10px rgba(255,69,58,0.3)' }}
                                            onClick={() => {
                                              customConfirm(`Biztosan törölni szeretnéd a(z) ${inv.name} raktárcikket?`, () => {
                                                const updated = inventory.filter((i: any) => i.id !== inv.id);
                                                saveDatabase({ ...db, inventory: updated });
                                              });
                                            }}
                                          >
                                            Töröl
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {inventory.length === 0 && (
                                  <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                                      Nincsenek raktárcikkek rögzítve a rendszerben.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Middle Slide: Kategóriák table */}
                        <div style={{ width: '33.333%', flexShrink: 0, paddingLeft: '12px', paddingRight: '12px' }}>
                          <div className="table-container" style={{ maxHeight: 'calc(100vh - 310px)', overflowY: 'auto', paddingBottom: '10px' }}>
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>ID</th>
                                  <th>Kategória Név</th>
                                  <th>Leírás</th>
                                  <th>Láthatóság</th>
                                  <th style={{ textAlign: 'right' }}>Műveletek</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invCategories.map((cat: any) => {
                                  const isInactive = cat.is_active === false;
                                  return (
                                    <tr key={cat.id} style={{ opacity: isInactive ? 0.45 : 1, transition: 'opacity 0.2s ease' }}>
                                      <td style={{ fontWeight: 600 }}>#{cat.id}</td>
                                      <td style={{ fontWeight: 700 }}>{cat.name}</td>
                                      <td style={{ color: 'var(--text-secondary)' }}>{cat.description || '-'}</td>
                                      <td>
                                        <button 
                                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                          onClick={() => {
                                            const updated = invCategories.map((c: any) => 
                                              c.id === cat.id ? { ...c, is_active: c.is_active === false ? true : false } : c
                                            );
                                            saveDatabase({ ...db, inventoryCategories: updated });
                                          }}
                                        >
                                          {isInactive ? (
                                            <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                              <EyeOff size={14} /> Rejtett
                                            </span>
                                          ) : (
                                            <span style={{ color: '#30d158', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                                              <Eye size={14} /> Aktív
                                            </span>
                                          )}
                                        </button>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                                          <button 
                                            className="btn" 
                                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '14px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => {
                                              setInvCatName(cat.name);
                                              setInvCatDescription(cat.description || '');
                                              setEditingInvCat(cat);
                                            }}
                                          >
                                            Szerkeszt
                                          </button>
                                          <button 
                                            className="btn btn-danger" 
                                            style={{ background: '#ff453a', border: 'none', color: 'white', borderRadius: '14px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 10px rgba(255,69,58,0.3)' }}
                                            onClick={() => {
                                              // Data integrity check: check if any items belong to this category
                                              const hasItems = inventory.some((i: any) => i.category_id === cat.id);
                                              if (hasItems) {
                                                alert('Nem törölheted ezt a kategóriát, mert jelenleg még tartoznak alá raktárcikkek! Először sorold át őket más kategóriába.');
                                                return;
                                              }
                                              customConfirm(`Biztosan törölni szeretnéd a(z) ${cat.name} raktár kategóriát?`, () => {
                                                const updated = invCategories.filter((c: any) => c.id !== cat.id);
                                                saveDatabase({ ...db, inventoryCategories: updated });
                                              });
                                            }}
                                          >
                                            Töröl
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {invCategories.length === 0 && (
                                  <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                                      Nincsenek raktár kategóriák rögzítve.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Right Slide: Beszerzési helyek table */}
                        <div style={{ width: '33.333%', flexShrink: 0, paddingLeft: '12px' }}>
                          <div className="table-container" style={{ maxHeight: 'calc(100vh - 310px)', overflowY: 'auto', paddingBottom: '10px' }}>
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Partner Név</th>
                                  <th>Helyszín / Cím</th>
                                  <th>Leírás</th>
                                  <th>Láthatóság</th>
                                  <th style={{ textAlign: 'right' }}>Műveletek</th>
                                </tr>
                              </thead>
                              <tbody>
                                {suppliers.map((supp: any) => {
                                  const isInactive = supp.is_active === false;
                                  return (
                                    <tr key={supp.id} style={{ opacity: isInactive ? 0.45 : 1, transition: 'opacity 0.2s ease' }}>
                                      <td style={{ fontWeight: 700 }}>{supp.name}</td>
                                      <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{supp.address || '-'}</td>
                                      <td style={{ color: 'var(--text-secondary)' }}>{supp.description || '-'}</td>
                                      <td>
                                        <button 
                                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                          onClick={() => {
                                            const updated = suppliers.map((s: any) => 
                                              s.id === supp.id ? { ...s, is_active: s.is_active === false ? true : false } : s
                                            );
                                            saveDatabase({ ...db, suppliers: updated });
                                          }}
                                        >
                                          {isInactive ? (
                                            <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                              <EyeOff size={14} /> Rejtett
                                            </span>
                                          ) : (
                                            <span style={{ color: '#30d158', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                                              <Eye size={14} /> Aktív
                                            </span>
                                          )}
                                        </button>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                                          <button 
                                            className="btn" 
                                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '14px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => {
                                              setSupplierName(supp.name);
                                              setSupplierAddress(supp.address || '');
                                              setSupplierDescription(supp.description || '');
                                              setEditingSupplier(supp);
                                            }}
                                          >
                                            Szerkeszt
                                          </button>
                                          <button 
                                            className="btn btn-danger" 
                                            style={{ background: '#ff453a', border: 'none', color: 'white', borderRadius: '14px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 10px rgba(255,69,58,0.3)' }}
                                              onClick={() => {
                                                // Data integrity check: check if any items are bound to this supplier
                                                const hasItems = inventory.some((i: any) => i.supplier_id === supp.id);
                                                if (hasItems) {
                                                  alert('Nem törölheted ezt a beszerzési helyet, mert jelenleg még kapcsolódnak hozzá raktárcikkek!');
                                                  return;
                                                }
                                                customConfirm(`Biztosan törölni szeretnéd a(z) ${supp.name} beszerzési helyet?`, () => {
                                                  const updated = suppliers.filter((s: any) => s.id !== supp.id);
                                                  saveDatabase({ ...db, suppliers: updated });
                                                });
                                              }}
                                          >
                                            Töröl
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {suppliers.length === 0 && (
                                  <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                                      Nincsenek beszerzési helyek rögzítve.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* MODAL OVERLAY: EDIT/ADD INVENTORY ITEM */}
                    {editingInvItem && (
                      <div className="modal-overlay" onClick={() => setEditingInvItem(null)}>
                        <div className="modal-card" style={{ maxWidth: '520px', width: '90%', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px' }} onClick={e => e.stopPropagation()}>
                          <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span className="modal-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                              {editingInvItem.id === 'NEW' ? 'Új raktárcikk hozzáadása' : 'Raktárcikk szerkesztése'}
                            </span>
                            <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditingInvItem(null)}>
                              <X size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Name */}
                            <div>
                              <label className="input-label">Raktárcikk neve</label>
                              <input 
                                type="text" 
                                className="input-field" 
                                value={invItemName} 
                                onChange={e => setInvItemName(e.target.value)} 
                                placeholder="pl: Trapista sajt"
                              />
                            </div>

                            {/* Category & Supplier */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label className="input-label">Kategória (Nem kötelező)</label>
                                <AppleSelect
                                  value={invItemCategoryId}
                                  onChange={val => setInvItemCategoryId(val === 'none' ? 'none' : Number(val))}
                                  options={[
                                    { value: 'none', label: '-- Nincs kategória --' },
                                    ...invCategories.map((c: any) => ({ value: c.id, label: c.name }))
                                  ]}
                                  icon={<Layers size={12} />}
                                  isOpen={openInvCatDropdown}
                                  onToggle={() => setOpenInvCatDropdown(!openInvCatDropdown)}
                                  onClose={() => setOpenInvCatDropdown(false)}
                                />
                              </div>
                              <div>
                                <label className="input-label">Beszerzési hely</label>
                                <AppleSelect
                                  value={invItemSupplierId}
                                  onChange={val => setInvItemSupplierId(String(val))}
                                  options={suppliers.map((s: any) => ({ value: s.id, label: s.name }))}
                                  icon={<Truck size={12} />}
                                  isOpen={openInvSupplierDropdown}
                                  onToggle={() => setOpenInvSupplierDropdown(!openInvSupplierDropdown)}
                                  onClose={() => setOpenInvSupplierDropdown(false)}
                                />
                              </div>
                            </div>

                            {/* Quantity, Unit & Warning Limit */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 1fr', gap: '12px' }}>
                              <div>
                                <label className="input-label">Mennyiség</label>
                                <input 
                                  type="number" 
                                  className="input-field" 
                                  value={invItemQuantity} 
                                  onChange={e => setInvItemQuantity(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} 
                                />
                              </div>
                              <div>
                                <label className="input-label">Egység</label>
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  value={invItemUnit} 
                                  onChange={e => setInvItemUnit(e.target.value)} 
                                  placeholder="pl: kg, db"
                                />
                              </div>
                              <div>
                                <label className="input-label">Min. limit (Riasztás)</label>
                                <input 
                                  type="number" 
                                  className="input-field" 
                                  value={invItemWarningLimit} 
                                  onChange={e => setInvItemWarningLimit(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} 
                                />
                              </div>
                            </div>

                            <div>
                              <label className="input-label">Dupla adag extra ára (Ft)</label>
                              <input 
                                type="number" 
                                className="input-field" 
                                value={invItemDoubleExtraPrice} 
                                onChange={e => setInvItemDoubleExtraPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} 
                                placeholder="Pl: 200"
                              />
                            </div>

                            {/* Purchase Frequency & Procurement Checkbox */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: '12px', alignItems: 'flex-end', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                              <div>
                                <label className="input-label">Beszerzési gyakoriság</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <input 
                                    type="number" 
                                    className="input-field" 
                                    style={{ width: '70px' }}
                                    value={invItemFreqValue} 
                                    onChange={e => setInvItemFreqValue(e.target.value === '' ? '' : parseInt(e.target.value) || 1)} 
                                  />
                                  <AppleSelect
                                    value={invItemFreqUnit}
                                    onChange={val => setInvItemFreqUnit(val as 'day' | 'week')}
                                    options={[
                                      { value: 'day', label: 'naponta' },
                                      { value: 'week', label: 'hetente' }
                                    ]}
                                    icon={<Clock size={12} />}
                                    isOpen={openInvFreqDropdown}
                                    onToggle={() => setOpenInvFreqDropdown(!openInvFreqDropdown)}
                                    onClose={() => setOpenInvFreqDropdown(false)}
                                  />
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', height: '36px', gap: '8px' }}>
                                <input 
                                  type="checkbox" 
                                  id="procurement-check"
                                  checked={invItemProcurement}
                                  onChange={e => setInvItemProcurement(e.target.checked)}
                                  style={{ width: '16px', height: '16px', accentColor: '#bf5af2', cursor: 'pointer' }}
                                />
                                <label htmlFor="procurement-check" style={{ fontSize: '12px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                                  Beszerzés alatt
                                </label>
                              </div>
                            </div>

                            {/* INFORMATION BOX (Last fill logs and prediction) */}
                            {editingInvItem.id !== 'NEW' && (
                              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', marginTop: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontWeight: 700, color: '#bf5af2', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.6px' }}>Készletfeltöltési Információk</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Utoljára feltöltve:</span>
                                  <span style={{ fontWeight: 600, color: 'white' }}>{formatDate(editingInvItem.last_filled_at)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Feltöltést végezte:</span>
                                  <span style={{ fontWeight: 600, color: 'white' }}>{editingInvItem.last_filled_by || 'Rendszer'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '4px', marginTop: '2px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Következő feltöltés várható:</span>
                                  <span style={{ fontWeight: 700, color: 'var(--warning)' }}>
                                    {calculateNextFill(editingInvItem.last_filled_at, `${invItemFreqValue} ${invItemFreqUnit === 'week' ? 'hét' : 'nap'}`)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                              <button className="btn" onClick={() => setEditingInvItem(null)}>Mégse</button>
                              <button 
                                className="btn btn-primary"
                                style={{ background: '#bf5af2', border: '1px solid rgba(191,90,242,0.4)', boxShadow: '0 0 10px rgba(191,90,242,0.2)' }}
                                onClick={() => {
                                  if (!invItemName.trim()) {
                                    alert('A raktárcikk nevének kitöltése kötelező!');
                                    return;
                                  }

                                  const categoryId = invItemCategoryId === 'none' ? null : invItemCategoryId;
                                  const frequencyStr = `${Number(invItemFreqValue) || 1} ${invItemFreqUnit === 'week' ? 'hetente' : 'naponta'}`;

                                  let updated;
                                  if (editingInvItem.id === 'NEW') {
                                    // Add new raktárcikk
                                    const newId = inventory.length > 0 ? Math.max(...inventory.map((i: any) => i.id)) + 1 : 1;
                                    const newItem = {
                                      id: newId,
                                      name: invItemName.trim(),
                                      category_id: categoryId,
                                      quantity: Number(invItemQuantity) || 0,
                                      unit: invItemUnit.trim() || 'kg',
                                      warning_limit: Number(invItemWarningLimit) || 0,
                                      supplier_id: invItemSupplierId,
                                      purchase_frequency: frequencyStr,
                                      last_filled_at: new Date().toISOString(),
                                      last_filled_by: currentUser?.name || 'Rendszer',
                                      is_under_procurement: invItemProcurement,
                                      double_extra_price: Number(invItemDoubleExtraPrice) || 0,
                                      is_active: true
                                    };
                                    updated = [...inventory, newItem];
                                  } else {
                                    // Update existing raktárcikk
                                    // Autodetect fill event: if new quantity is greater than previous, update fill logs
                                    const isFilled = (Number(invItemQuantity) || 0) > editingInvItem.quantity;
                                    
                                    updated = inventory.map((i: any) => 
                                      i.id === editingInvItem.id 
                                        ? {
                                            ...i,
                                            name: invItemName.trim(),
                                            category_id: categoryId,
                                            quantity: Number(invItemQuantity) || 0,
                                            unit: invItemUnit.trim() || 'kg',
                                            warning_limit: Number(invItemWarningLimit) || 0,
                                            supplier_id: invItemSupplierId,
                                            purchase_frequency: frequencyStr,
                                            is_under_procurement: invItemProcurement,
                                            double_extra_price: Number(invItemDoubleExtraPrice) || 0,
                                            last_filled_at: isFilled ? new Date().toISOString() : i.last_filled_at,
                                            last_filled_by: isFilled ? (currentUser?.name || 'Rendszer') : i.last_filled_by
                                          }
                                        : i
                                    );
                                  }

                                  saveDatabase({ ...db, inventory: updated });
                                  setEditingInvItem(null);
                                }}
                              >
                                Mentés
                              </button>
                            </div>

                          </div>
                        </div>
                      </div>
                    )}

                    {/* MODAL OVERLAY: EDIT/ADD CATEGORY */}
                    {editingInvCat && (
                      <div className="modal-overlay" onClick={() => setEditingInvCat(null)}>
                        <div className="modal-card" style={{ maxWidth: '450px', width: '90%', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px' }} onClick={e => e.stopPropagation()}>
                          <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span className="modal-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                              {editingInvCat.id === 'NEW' ? 'Új kategória hozzáadása' : 'Kategória szerkesztése'}
                            </span>
                            <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditingInvCat(null)}>
                              <X size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <label className="input-label">Kategória neve</label>
                              <input 
                                type="text" 
                                className="input-field" 
                                value={invCatName} 
                                onChange={e => setInvCatName(e.target.value)} 
                                placeholder="pl: Fűszerek"
                              />
                            </div>
                            <div>
                              <label className="input-label">Leírás</label>
                              <input 
                                type="text" 
                                className="input-field" 
                                value={invCatDescription} 
                                onChange={e => setInvCatDescription(e.target.value)} 
                                placeholder="pl: Konyhai fűszerek és ételízesítők"
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                              <button className="btn" onClick={() => setEditingInvCat(null)}>Mégse</button>
                              <button 
                                className="btn btn-primary"
                                style={{ background: '#bf5af2', border: '1px solid rgba(191,90,242,0.4)', boxShadow: '0 0 10px rgba(191,90,242,0.2)' }}
                                onClick={() => {
                                  if (!invCatName.trim()) {
                                    alert('A kategória nevének kitöltése kötelező!');
                                    return;
                                  }

                                  let updated;
                                  if (editingInvCat.id === 'NEW') {
                                    const newId = invCategories.length > 0 ? Math.max(...invCategories.map((c: any) => c.id)) + 1 : 1;
                                    const newCat = {
                                      id: newId,
                                      name: invCatName.trim(),
                                      description: invCatDescription.trim(),
                                      is_active: true
                                    };
                                    updated = [...invCategories, newCat];
                                  } else {
                                    updated = invCategories.map((c: any) => 
                                      c.id === editingInvCat.id 
                                        ? { ...c, name: invCatName.trim(), description: invCatDescription.trim() }
                                        : c
                                    );
                                  }

                                  saveDatabase({ ...db, inventoryCategories: updated });
                                  setEditingInvCat(null);
                                }}
                              >
                                Mentés
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MODAL OVERLAY: EDIT/ADD SUPPLIER */}
                    {editingSupplier && (
                      <div className="modal-overlay" onClick={() => setEditingSupplier(null)}>
                        <div className="modal-card" style={{ maxWidth: '480px', width: '90%', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px' }} onClick={e => e.stopPropagation()}>
                          <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span className="modal-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                              {editingSupplier.id === 'NEW' ? 'Új Beszerzési hely hozzáadása' : 'Beszerzési hely szerkesztése'}
                            </span>
                            <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditingSupplier(null)}>
                              <X size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <label className="input-label">Beszerzési hely neve</label>
                              <input 
                                type="text" 
                                className="input-field" 
                                value={supplierName} 
                                onChange={e => setSupplierName(e.target.value)} 
                                placeholder="pl: CBA Príma Nagyker"
                              />
                            </div>
                            <div>
                              <label className="input-label">Helyszín / Cím</label>
                              <input 
                                type="text" 
                                className="input-field" 
                                value={supplierAddress} 
                                onChange={e => setSupplierAddress(e.target.value)} 
                                placeholder="pl: Zalaegerszeg, Zrínyi Miklós út 14."
                              />
                            </div>
                            <div>
                              <label className="input-label">Leírás</label>
                              <input 
                                type="text" 
                                className="input-field" 
                                value={supplierDescription} 
                                onChange={e => setSupplierDescription(e.target.value)} 
                                placeholder="pl: Helyi zöldségek és szárazáru"
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                              <button className="btn" onClick={() => setEditingSupplier(null)}>Mégse</button>
                              <button 
                                className="btn btn-primary"
                                style={{ background: '#bf5af2', border: '1px solid rgba(191,90,242,0.4)', boxShadow: '0 0 10px rgba(191,90,242,0.2)' }}
                                onClick={() => {
                                  if (!supplierName.trim()) {
                                    alert('A partner nevének kitöltése kötelező!');
                                    return;
                                  }

                                  let updated;
                                  if (editingSupplier.id === 'NEW') {
                                    const newId = `SUPP-${Date.now()}`;
                                    const newSupp = {
                                      id: newId,
                                      name: supplierName.trim(),
                                      address: supplierAddress.trim(),
                                      description: supplierDescription.trim(),
                                      is_active: true
                                    };
                                    updated = [...suppliers, newSupp];
                                  } else {
                                    updated = suppliers.map((s: any) => 
                                      s.id === editingSupplier.id 
                                        ? { ...s, name: supplierName.trim(), address: supplierAddress.trim(), description: supplierDescription.trim() }
                                        : s
                                    );
                                  }

                                  saveDatabase({ ...db, suppliers: updated });
                                  setEditingSupplier(null);
                                }}
                              >
                                Mentés
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* TAB: PERMISSIONS */}
              {adminTab === 'permissions' && (() => {
                const PALETTE_COLORS = [
                  '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', 
                  '#64d2ff', '#0a84ff', '#bf5af2', '#ff375f'
                ];
                const PALETTE_SYMBOLS = [
                  'ChefHat', 'Truck', 'Flame', 'Coffee', 
                  'Bell', 'Utensils', 'Shield', 'User'
                ];

                return (
                  <>
                    <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 className="admin-title" style={{ margin: 0 }}>Munkatársi Fiókok & Jogosultságok</h2>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => setEditingUserItem('NEW')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Plus size={16} /> Új Munkatárs Hozzáadása
                      </button>
                    </div>

                    <div className="table-container" style={{ maxHeight: 'calc(100vh - 310px)', overflowY: 'auto' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Munkatárs</th>
                            <th>Felhasználónév</th>
                            <th>Telefonszám</th>
                            <th>Főprogram Jogkör</th>
                            <th>Portál Beosztások</th>
                            <th>Kitiltva</th>
                            <th style={{ textAlign: 'right' }}>Műveletek</th>
                          </tr>
                        </thead>
                        <tbody>
                          {db.users.map((u: UserItem) => (
                            <tr key={u.id} style={{ opacity: u.is_banned ? 0.4 : 1 }}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: u.color || '#bf5af2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: u.color ? `0 0 8px ${u.color}33` : 'none'
                                  }}>
                                    {renderUserIcon(u.symbol || 'User', 14, 'white')}
                                  </div>
                                  <span style={{ fontWeight: 600, color: 'white' }}>{u.name}</span>
                                </div>
                              </td>
                              <td>{u.username}</td>
                              <td>{u.phone_number || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nincs</span>}</td>
                              <td>
                                <span className={`order-status ${u.role === 'admin' ? 'completed' : 'pending'}`} style={{ fontSize: '11px', padding: '2px 6px' }}>
                                  {u.role === 'admin' ? 'Rendszergazda (Admin)' : 'Kiszolgáló (Staff)'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {u.web_roles && u.web_roles.length > 0 ? (
                                    u.web_roles.map((r: string) => (
                                      <span key={r} style={{
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        background: r === 'Szakács' ? 'rgba(255,159,10,0.12)' : r === 'Futár' ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.06)',
                                        border: r === 'Szakács' ? '1px solid rgba(255,159,10,0.2)' : r === 'Futár' ? '1px solid rgba(10,132,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
                                        color: r === 'Szakács' ? '#ff9f0a' : r === 'Futár' ? '#0a84ff' : 'var(--text-secondary)',
                                        padding: '1px 5px',
                                        borderRadius: '4px'
                                      }}>
                                        {r}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>Nincs beosztása</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {u.is_banned ? (
                                  <span style={{ color: '#ff453a', fontWeight: 600, fontSize: '11px' }}>⚠️ Kitiltva</span>
                                ) : (
                                  <span style={{ color: 'var(--success)', fontSize: '11px' }}>Aktív</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button 
                                  className="btn" 
                                  style={{ padding: '4px 10px', fontSize: '11px' }}
                                  onClick={() => setEditingUserItem(u)}
                                >
                                  Szerkesztés
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* EDIT USER DRAWER / MODAL */}
                    {editingUserItem && (
                      <div className="modal-overlay" style={{ position: 'fixed', zIndex: 10000 }} onClick={() => setEditingUserItem(null)}>
                        <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: '440px' }}>
                          <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                            <span className="modal-title">
                              {editingUserItem === 'NEW' ? 'Új Munkatárs Fiók' : 'Munkatárs Fiók Szerkesztése'}
                            </span>
                            <button className="island-close-btn" onClick={() => setEditingUserItem(null)}>
                              <X size={14} />
                            </button>
                          </div>

                          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
                            <div>
                              <label className="input-label">Munkatárs Teljes Neve</label>
                              <input 
                                type="text"
                                className="input-field"
                                value={userEditName}
                                onChange={e => setUserEditName(e.target.value)}
                                placeholder="pl: Szabó Zoltán"
                              />
                            </div>
                            <div>
                              <label className="input-label">Telefonszám</label>
                              <input 
                                type="text"
                                className="input-field"
                                value={userEditPhone}
                                onChange={e => setUserEditPhone(e.target.value)}
                                placeholder="pl: +36301234567"
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div>
                                <label className="input-label">Felhasználónév</label>
                                <input 
                                  type="text"
                                  className="input-field"
                                  value={userEditUsername}
                                  onChange={e => setUserEditUsername(e.target.value)}
                                  placeholder="pl: zoli92"
                                />
                              </div>
                              <div>
                                <label className="input-label">Jelszó</label>
                                <input 
                                  type="text"
                                  className="input-field"
                                  value={userEditPassword}
                                  onChange={e => setUserEditPassword(e.target.value)}
                                  placeholder="Jelszó"
                                />
                              </div>
                            </div>

                            {/* Predefined Color selection */}
                            <div>
                              <label className="input-label">Megkülönböztető Szín</label>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {PALETTE_COLORS.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => setUserEditColor(c)}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      background: c,
                                      border: userEditColor === c ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                                      cursor: 'pointer',
                                      transform: userEditColor === c ? 'scale(1.15)' : 'scale(1)',
                                      transition: 'all 0.15s ease',
                                      boxShadow: userEditColor === c ? `0 0 10px ${c}` : 'none'
                                    }}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Predefined Symbol/Icon Selection */}
                            <div>
                              <label className="input-label">Megkülönböztető Szimbólum</label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '6px' }}>
                                {PALETTE_SYMBOLS.map(sym => (
                                  <button
                                    key={sym}
                                    onClick={() => setUserEditSymbol(sym)}
                                    style={{
                                      padding: '8px',
                                      borderRadius: '8px',
                                      border: userEditSymbol === sym ? `2px solid ${userEditColor}` : '1px solid rgba(255,255,255,0.08)',
                                      background: userEditSymbol === sym ? 'rgba(255,255,255,0.05)' : 'transparent',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {renderUserIcon(sym, 18, userEditSymbol === sym ? userEditColor : 'rgba(255,255,255,0.6)')}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Roles checkboxes */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                              <label className="input-label" style={{ marginBottom: '2px' }}>Fiók Jogkörök</label>
                              
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'white' }}>
                                <input 
                                  type="checkbox"
                                  checked={userEditDesktopRole === 'admin'}
                                  onChange={e => setUserEditDesktopRole(e.target.checked ? 'admin' : 'staff')}
                                  style={{ width: '15px', height: '15px', accentColor: userEditColor }}
                                />
                                <span>Főprogram Rendszergazda (Admin hozzáférés)</span>
                              </label>

                              {['Szakács', 'Futár', 'Diszpécser', 'Felszolgáló'].map(roleName => {
                                const checked = userEditWebRoles.includes(roleName);
                                return (
                                  <label key={roleName} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'white', marginLeft: '12px' }}>
                                    <input 
                                      type="checkbox"
                                      checked={checked}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setUserEditWebRoles([...userEditWebRoles, roleName]);
                                        } else {
                                          setUserEditWebRoles(userEditWebRoles.filter(r => r !== roleName));
                                        }
                                      }}
                                      style={{ width: '15px', height: '15px', accentColor: userEditColor }}
                                    />
                                    <span>{roleName} Portál hozzáférés</span>
                                  </label>
                                );
                              })}
                          </div>
                          </div>

                          <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', marginTop: '4px' }}>
                            {editingUserItem !== 'NEW' && (
                              <button 
                                className="btn" 
                                style={{ background: 'rgba(255,69,58,0.1)', color: '#ff453a', border: '1px solid rgba(255,69,58,0.2)', marginRight: 'auto' }}
                                onClick={() => handleDeleteUser((editingUserItem as UserItem).id)}
                              >
                                Fiók Törlése
                              </button>
                            )}
                            <button className="btn" onClick={() => setEditingUserItem(null)}>Mégse</button>
                            <button 
                              className="btn btn-primary" 
                              onClick={handleSaveUser}
                              style={{ background: userEditColor, border: 'none' }}
                            >
                              Mentés
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* TAB: DISPATCH */}
              {adminTab === 'dispatch' && (() => {
                const configs = getReceiptConfigs();
                const activeIndex = Math.max(0, Math.min(selectedConfigIndex, configs.length - 1));
                const config = configs[activeIndex] || configs[0];

                const updateConfig = (key: string, value: any) => {
                  const updatedConfigs = [...configs];
                  updatedConfigs[activeIndex] = {
                    ...config,
                    [key]: value
                  };
                  saveDatabase({
                    ...db,
                    receiptConfigs: updatedConfigs
                  });
                };

                const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      updateConfig('logoBase64', reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                };

                const handleAddConfig = () => {
                  const newCfg = {
                    ...config,
                    name: `${configs.length + 1}. Példány (Új)`,
                  };
                  saveDatabase({
                    ...db,
                    receiptConfigs: [...configs, newCfg]
                  });
                  setSelectedConfigIndex(configs.length);
                };

                const handleDeleteConfig = (idx: number) => {
                  if (configs.length <= 1) return;
                  const updatedConfigs = configs.filter((_, i) => i !== idx);
                  saveDatabase({
                    ...db,
                    receiptConfigs: updatedConfigs
                  });
                  setSelectedConfigIndex(Math.max(0, idx - 1));
                };

                // Mock order for live preview and test printing
                const previewOrder = {
                  id: 1234,
                  created_at: new Date().toISOString(),
                  created_by_user: currentUser?.name || 'Rendszer',
                  payment_method: 'Bankkártya',
                  discount_percentage: 10,
                  delivery_fee: 500,
                  total_amount: 6720,
                  customer_name: 'Kovács János',
                  customer_address: '8900 Zalaegerszeg, Kossuth Lajos utca 12.',
                  split_details: {
                    delivery_instructions: 'Csengő a kapun balra, kérem hívjon érkezéskor.'
                  },
                  items: [
                    { 
                      name: 'Margherita Pizza', 
                      quantity: 1, 
                      price_at_order: 1890, 
                      packaging_fee_at_order: 150,
                      custom_modifications: {
                        portion: 'full',
                        ingredient_adjustments: {
                          1: 'none',
                          3: 'double'
                        },
                        note: 'Ropogósra sütve'
                      }
                    },
                    { 
                      name: 'Bolognai Spagetti', 
                      quantity: 2, 
                      price_at_order: 2290, 
                      packaging_fee_at_order: 200,
                      custom_modifications: {
                        portion: 'half'
                      }
                    }
                  ]
                };

                const fontSizeMap: Record<string, string> = {
                  small: '11px',
                  medium: '13px',
                  large: '15px'
                };
                const lineSpacingMap: Record<string, string> = {
                  tight: '1.1',
                  normal: '1.4',
                  loose: '1.8'
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="admin-header">
                      <h2 className="admin-title">Rendelések továbbítása & Nyomtató Beállítások</h2>
                    </div>

                    {/* 1. Rendszer és Nyomtató Kapcsolatok */}
                    <div className="admin-card">
                      <span className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SlidersHorizontal size={18} color="#0a84ff" />
                        Továbbítási Csatornák & Eszközök
                      </span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '14px' }}>
                        {/* Nyomtató választó */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                          <div style={{ flex: 1, minWidth: '260px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              Epson TM-T20II Nyugtanyomtató Kiválasztása
                            </label>
                            <select
                              value={db.selectedPrinter || ''}
                              onChange={e => saveDatabase({ ...db, selectedPrinter: e.target.value })}
                              className="input-field"
                              style={{ width: '100%', height: '38px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', padding: '0 10px' }}
                            >
                              <option value="" style={{ background: '#1c1c1e' }}>Rendszer alapértelmezett (Silent print)</option>
                              {availablePrinters.map(p => (
                                <option key={p} value={p} style={{ background: '#1c1c1e' }}>{p}</option>
                              ))}
                            </select>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                              <span style={{ fontSize: '11px', color: availablePrinters.length > 0 ? '#30d158' : '#ff453a', fontWeight: 600 }}>
                                {availablePrinters.length > 0 
                                  ? `✓ Rendszerben észlelt eszközök (${availablePrinters.length} db):` 
                                  : '⚠️ Egyetlen fizikai nyomtatót sem észlelt a rendszer!'}
                              </span>
                              <button 
                                className="btn" 
                                onClick={refreshPrinters} 
                                style={{ padding: '2px 8px', fontSize: '10px', height: '22px', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                              >
                                Lista frissítése
                              </button>
                            </div>

                            {availablePrinters.length > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)', wordBreak: 'break-all' }}>
                                {availablePrinters.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nyomtatás Toggles */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '13px', display: 'block' }}>Automatikus nyugtanyomtatás</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>A "Beküldés" gombra való kattintáskor a blokk automatikusan kinyomtatódik.</span>
                          </div>
                          <input 
                            type="checkbox"
                            checked={db.autoPrintOnOrder !== false}
                            onChange={e => saveDatabase({ ...db, autoPrintOnOrder: e.target.checked })}
                            style={{ width: '20px', height: '20px', accentColor: '#0a84ff', cursor: 'pointer' }}
                          />
                        </div>

                        {/* Csendes Nyomtatás Toggle */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '13px', display: 'block' }}>Csendes nyomtatás (Silent mode)</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Bekapcsolva közvetlenül a nyomtatóra küldi a feladatot. Kikapcsolva megnyitja a Windows nyomtatási párbeszédpanelt a kézi vezérléshez és hibakereséshez.</span>
                          </div>
                          <input 
                            type="checkbox"
                            checked={config.silentPrint !== false}
                            onChange={e => updateConfig('silentPrint', e.target.checked)}
                            style={{ width: '20px', height: '20px', accentColor: '#0a84ff', cursor: 'pointer' }}
                          />
                        </div>

                        {/* Munkatársi Portálok Toggle */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '13px', display: 'block' }}>Munkatársi Portálok (Weboldalak) engedélyezése</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kikapcsolásakor a konyhai és futár felületek nem futnak, és nem kell nyilvántartani a bent lévő rendeléseket a főmenün.</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
                            <span style={{ fontSize: '11px', color: db.enableStaffPortals !== false ? '#30d158' : '#ff453a', fontWeight: 600 }}>
                              {db.enableStaffPortals !== false ? 'AKTÍV' : 'LEÁLLÍTVA'}
                            </span>
                            <div 
                              onClick={() => {
                                const nextVal = db.enableStaffPortals === false;
                                saveDatabase({
                                  ...db,
                                  enableStaffPortals: nextVal
                                });
                              }}
                              style={{
                                width: '36px',
                                height: '20px',
                                borderRadius: '10px',
                                background: db.enableStaffPortals !== false ? '#30d158' : '#ff453a',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease',
                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
                              }}
                            >
                              <div 
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  background: 'white',
                                  position: 'absolute',
                                  top: '2px',
                                  left: db.enableStaffPortals !== false ? '18px' : '2px',
                                  transition: 'left 0.2s ease',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                                }}
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Futár panel beállítások */}
                    <div className="admin-card">
                      <span className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={18} color="#0a84ff" />
                        Futár Panel Jogosultságok
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'white' }}>
                          <input 
                            type="checkbox"
                            checked={db.couriersCanReassign || false}
                            onChange={e => saveDatabase({ ...db, couriersCanReassign: e.target.checked })}
                            style={{ width: '18px', height: '18px', accentColor: '#0a84ff' }}
                          />
                          <span>Engedélyezze, hogy a futárok módosíthassák a rendelésekhez rendelt futárt</span>
                        </label>
                      </div>
                    </div>

                    {/* 2. Blokkszerkesztő Kártya */}
                    <div className="admin-card">
                      <span className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <FileText size={18} color="#bf5af2" />
                        Epson TM-T20II Nyugtaszerkesztő & Blokkdizájn
                      </span>

                      {/* Nyomtatandó példányok (Tabs) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', width: '100%' }}>
                          {configs.map((cfg, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedConfigIndex(idx)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                background: selectedConfigIndex === idx ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                                border: '1px solid ' + (selectedConfigIndex === idx ? 'var(--primary)' : 'rgba(255,255,255,0.08)'),
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: 600,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <span>{cfg.name || `${idx + 1}. Példány`}</span>
                              {configs.length > 1 && (
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteConfig(idx);
                                  }}
                                  style={{ 
                                    color: 'rgba(255,255,255,0.6)', 
                                    marginLeft: '4px',
                                    fontSize: '11px', 
                                    cursor: 'pointer',
                                    padding: '0 4px',
                                    borderRadius: '4px',
                                    background: 'rgba(0,0,0,0.15)'
                                  }}
                                  title="Példány törlése"
                                >
                                  ✕
                                </span>
                              )}
                            </div>
                          ))}
                          <button 
                            className="btn" 
                            onClick={handleAddConfig}
                            style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(48, 209, 88, 0.15)', color: '#30d158', border: '1px solid rgba(48, 209, 88, 0.25)', borderRadius: '8px' }}
                          >
                            + Új Példány
                          </button>
                        </div>
                      </div>

                      {/* Példány egyedi neve és stílus szerkesztő */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Aktív Példány megnevezése (pl. Vendégblokk, Konyha, Futár)</label>
                          <input 
                            type="text" 
                            value={config.name || ''} 
                            onChange={e => updateConfig('name', e.target.value)}
                            className="input-field"
                            style={{ width: '100%', height: '34px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
                            placeholder="E.g. Vendégblokk"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nyomtatási Elrendezés Stílus</label>
                          <select
                            value={config.layoutPreset || 'classic'}
                            onChange={e => updateConfig('layoutPreset', e.target.value)}
                            className="input-field"
                            style={{ width: '100%', height: '34px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
                          >
                            <option value="classic" style={{ background: '#1c1c1e' }}>Klasszikus Éttermi (Standard)</option>
                            <option value="delivery" style={{ background: '#1c1c1e' }}>Futár-fókuszú (Cím legfelül)</option>
                            <option value="kitchen" style={{ background: '#1c1c1e' }}>Konyhai bizonylat (Csak ételek & árak nélkül)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', marginTop: '10px' }}>
                        {/* Bal Oszlop - Beállítások */}
                        <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          
                          {/* Logo feltöltés */}
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Nyugta Logo Feltöltése</label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <input 
                                type="file" 
                                accept="image/*" 
                                id="receipt-logo-file"
                                onChange={handleLogoUpload}
                                style={{ display: 'none' }}
                              />
                              <button 
                                className="btn btn-primary"
                                style={{ padding: '6px 14px', fontSize: '12px' }}
                                onClick={() => document.getElementById('receipt-logo-file')?.click()}
                              >
                                Tallózás...
                              </button>
                              {config.logoBase64 && (
                                <>
                                  <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '4px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <img src={config.logoBase64} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                  </div>
                                  <button 
                                    className="btn"
                                    style={{ padding: '6px 10px', fontSize: '11px', background: 'rgba(255,69,58,0.1)', color: '#ff453a', border: '1px solid rgba(255,69,58,0.2)' }}
                                    onClick={() => updateConfig('logoBase64', '')}
                                  >
                                    Törlés
                                  </button>
                                </>
                              )}
                            </div>

                            {config.logoBase64 && (
                              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Logó elhelyezkedése:</span>
                                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px' }}>
                                    {['top', 'before_items', 'bottom'].map(pos => (
                                      <button
                                        key={pos}
                                        onClick={() => updateConfig('logoPosition', pos)}
                                        style={{ border: 'none', background: config.logoPosition === pos ? 'var(--primary)' : 'transparent', color: 'white', fontSize: '10px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}
                                      >
                                        {pos === 'top' ? 'Legfelül' : pos === 'before_items' ? 'Középen' : 'Lul'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Logó igazítása:</span>
                                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px' }}>
                                    {['left', 'center', 'right'].map(align => (
                                      <button
                                        key={align}
                                        onClick={() => updateConfig('logoAlignment', align)}
                                        style={{ border: 'none', background: config.logoAlignment === align ? 'var(--primary)' : 'transparent', color: 'white', fontSize: '10px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}
                                      >
                                        {align === 'left' ? 'Bal' : align === 'center' ? 'Közép' : 'Jobb'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    <span>Logó mérete:</span>
                                    <span style={{ color: 'white', fontWeight: 'bold' }}>{config.logoScale}%</span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="20" 
                                    max="100" 
                                    value={config.logoScale} 
                                    onChange={e => updateConfig('logoScale', parseInt(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Szövegek */}
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Fejléc szövege (Cím, adatok)</label>
                            <textarea
                              value={config.headerText || ''}
                              onChange={e => updateConfig('headerText', e.target.value)}
                              className="input-field"
                              style={{ width: '100%', height: '70px', padding: '8px 10px', fontSize: '13px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', resize: 'vertical' }}
                              placeholder="Étterem neve, telefonszám..."
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Lábléc szövege (Köszönet, üzenet)</label>
                            <textarea
                              value={config.footerText || ''}
                              onChange={e => updateConfig('footerText', e.target.value)}
                              className="input-field"
                              style={{ width: '100%', height: '70px', padding: '8px 10px', fontSize: '13px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', resize: 'vertical' }}
                              placeholder="Köszönjük a vásárlást!..."
                            />
                          </div>

                          {/* Formázás */}
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Betűméret</label>
                              <select
                                value={config.fontSize || 'medium'}
                                onChange={e => updateConfig('fontSize', e.target.value)}
                                className="input-field"
                                style={{ width: '100%', height: '34px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '6px', padding: '0 8px' }}
                              >
                                <option value="small" style={{ background: '#1c1c1e' }}>Kicsi (11px)</option>
                                <option value="medium" style={{ background: '#1c1c1e' }}>Közepes (13px)</option>
                                <option value="large" style={{ background: '#1c1c1e' }}>Nagy (15px)</option>
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Sorköz</label>
                              <select
                                value={config.lineSpacing || 'normal'}
                                onChange={e => updateConfig('lineSpacing', e.target.value)}
                                className="input-field"
                                style={{ width: '100%', height: '34px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '6px', padding: '0 8px' }}
                              >
                                <option value="tight" style={{ background: '#1c1c1e' }}>Szoros (1.1)</option>
                                <option value="normal" style={{ background: '#1c1c1e' }}>Normál (1.4)</option>
                                <option value="loose" style={{ background: '#1c1c1e' }}>Ritka (1.8)</option>
                              </select>
                            </div>
                          </div>

                          {/* Toggles */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Megjelenített blokkelemek:</span>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              {[
                                { key: 'showOrderId', label: 'Nyugtaszám' },
                                { key: 'showTimestamp', label: 'Dátum és idő' },
                                { key: 'showPaymentMethod', label: 'Fizetési mód' },
                                { key: 'showCustomerDetails', label: 'Vevő adatai' },
                                { key: 'showComment', label: 'Megjegyzések' },
                                { key: 'showPackagingFee', label: 'Csomagolási díj' },
                                { key: 'showDeliveryFee', label: 'Szállítási díj' },
                                { key: 'showDiscount', label: 'Kedvezmények' }
                              ].map(item => (
                                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                  <input 
                                    type="checkbox"
                                    checked={(config as any)[item.key] !== false}
                                    onChange={e => updateConfig(item.key, e.target.checked)}
                                    style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                                  />
                                  <span>{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Tesztnyomtatás */}
                          <button 
                            className="btn btn-primary"
                            style={{ height: '40px', fontWeight: 600, background: 'linear-gradient(135deg, #bf5af2 0%, #ff453a 100%)', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            onClick={() => printOrderReceipt(previewOrder)}
                          >
                            <FileText size={16} />
                            Tesztblokk Nyomtatása
                          </button>
                        </div>

                        {/* Jobb Oszlop - Epson TM-T20II Élő előnézet (80mm) */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '310px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                            Élő bizonylat előnézet (Epson 80mm kalibrált)
                          </span>

                          <div 
                            className="receipt-container"
                            style={{
                              width: '300px',
                              background: '#ffffff',
                              color: '#000000',
                              padding: '20px 14px 28px 14px',
                              fontFamily: "'Courier New', Courier, monospace",
                              fontSize: fontSizeMap[config.fontSize] || '13px',
                              lineHeight: lineSpacingMap[config.lineSpacing] || '1.4',
                              boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                              position: 'relative',
                              border: '1px solid #d1d1d6',
                              borderBottom: 'none',
                              borderRadius: '4px 4px 0 0',
                              userSelect: 'none'
                            }}
                          >
                            {/* Render Preview according to Layout Preset */}
                            {(() => {
                              const layout = config.layoutPreset || 'classic';
                              const showPrices = layout !== 'kitchen';

                              const previewLogo = config.logoBase64 && layout !== 'kitchen' ? (
                                <div style={{ textAlign: config.logoAlignment as any, padding: '4px 0 10px 0' }}>
                                  <img src={config.logoBase64} style={{ maxWidth: `${config.logoScale}%`, height: 'auto' }} />
                                </div>
                              ) : null;

                              const previewHeader = config.headerText && layout !== 'kitchen' ? (
                                <div style={{ textAlign: 'center', fontWeight: 'bold', whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
                                  {config.headerText}
                                </div>
                              ) : null;

                              const previewMetadata = (
                                <>
                                  {config.showOrderId && <div><strong>Nyugtaszám:</strong> #1234</div>}
                                  {config.showTimestamp && <div><strong>Dátum:</strong> {new Date().toLocaleString('hu-HU')}</div>}
                                  <div><strong>Kiszolgáló:</strong> Rendszergazda</div>
                                </>
                              );

                              const previewCustomer = config.showCustomerDetails ? (
                                <div style={{ 
                                  background: layout === 'delivery' ? '#000' : 'transparent',
                                  color: layout === 'delivery' ? '#fff' : '#000',
                                  padding: layout === 'delivery' ? '6px 8px' : '0',
                                  border: layout === 'delivery' ? '2px solid #000' : 'none',
                                  borderRadius: layout === 'delivery' ? '4px' : '0',
                                  marginTop: '6px',
                                  marginBottom: '6px'
                                }}>
                                  <div style={{ fontWeight: 'bold', fontSize: layout === 'delivery' ? '110%' : '100%', textTransform: 'uppercase' }}>🚗 Kiszállítási adatok:</div>
                                  <div>Vevő: Kovács János</div>
                                  <div style={{ fontWeight: 'bold', fontSize: layout === 'delivery' ? '120%' : '105%' }}>8900 Zalaegerszeg, Kossuth Lajos utca 12.</div>
                                  {config.showComment && (
                                    <div style={{ fontSize: '90%', fontStyle: 'italic', marginTop: '2px', fontWeight: 'bold' }}>
                                      Megjegyzés: Csengő a kapun balra...
                                    </div>
                                  )}
                                </div>
                              ) : null;

                              const previewItems = (
                                <>
                                  {/* Table Header */}
                                  <div style={{ display: 'flex', fontWeight: 'bold', borderBottom: '1px solid #000000', paddingBottom: '3px', marginBottom: '4px' }}>
                                    <span style={{ flex: 1 }}>Tétel</span>
                                    <span style={{ width: '40px', textAlign: 'center' }}>Db</span>
                                    {showPrices && <span style={{ width: '80px', textAlign: 'right' }}>Érték</span>}
                                  </div>

                                  {/* Table Items */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {previewOrder.items.map((item: any, idx: number) => {
                                      const price = item.price_at_order;
                                      let subnotes: string[] = [];
                                      if (item.custom_modifications) {
                                        const mods = item.custom_modifications;
                                        if (mods.portion === 'half') {
                                          subnotes.push('⚠️ FÉL ADAG');
                                        }
                                        if (mods.ingredient_adjustments) {
                                          Object.entries(mods.ingredient_adjustments).forEach(([ingIdStr, status]) => {
                                            const ingId = parseInt(ingIdStr);
                                            const ingredient = db.inventory.find((i: any) => i.id === ingId);
                                            if (ingredient) {
                                              if (status === 'none') {
                                                subnotes.push(`❌ NÉLKÜL: ${ingredient.name.toUpperCase()}`);
                                              } else if (status === 'double') {
                                                subnotes.push(`➕ DUPLA: ${ingredient.name.toUpperCase()}`);
                                              }
                                            }
                                          });
                                        }
                                        if (mods.note && mods.note.trim()) {
                                          subnotes.push(`💬 MEGJEGYZÉS: ${mods.note.trim().toUpperCase()}`);
                                        }
                                      }

                                      return (
                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                                          <div style={{ display: 'flex' }}>
                                            <span style={{ flex: 1, fontWeight: 'bold', fontSize: layout === 'kitchen' ? '110%' : '100%' }}>{item.name}</span>
                                            <span style={{ width: '40px', textAlign: 'center', fontWeight: 'bold', fontSize: layout === 'kitchen' ? '110%' : '100%' }}>{item.quantity}</span>
                                            {showPrices && <span style={{ width: '80px', textAlign: 'right' }}>{(price * item.quantity).toLocaleString()} Ft</span>}
                                          </div>
                                          {subnotes.length > 0 && (
                                            <div style={{ fontSize: '85%', paddingLeft: '6px', marginTop: '2px', borderLeft: '2px solid #000', fontWeight: 'bold', lineHeight: '1.2' }}>
                                              {subnotes.map((n, i) => (
                                                <div key={i}>{n}</div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              );

                              const previewTotals = showPrices ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Részösszeg:</span>
                                    <span>6 470 Ft</span>
                                  </div>
                                  {config.showPackagingFee && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Csomagolási díj:</span>
                                      <span>550 Ft</span>
                                    </div>
                                  )}
                                  {config.showDeliveryFee && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Szállítási díj:</span>
                                      <span>500 Ft</span>
                                    </div>
                                  )}
                                  {config.showDiscount && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Kedvezmény (10%):</span>
                                      <span>-702 Ft</span>
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '110%', marginTop: '6px' }}>
                                    <span>ÖSSZESEN{config.showPaymentMethod ? ` (${previewOrder.payment_method})` : ''}:</span>
                                    <span>6 818 Ft</span>
                                  </div>
                                </div>
                              ) : null;

                              const previewFooter = config.footerText && layout !== 'kitchen' ? (
                                <div style={{ textAlign: 'center', fontWeight: 'bold', whiteSpace: 'pre-wrap', marginTop: '6px' }}>
                                  {config.footerText}
                                </div>
                              ) : null;

                              if (layout === 'delivery') {
                                return (
                                  <>
                                    {previewCustomer}
                                    <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }}></div>
                                    {config.logoPosition === 'top' && previewLogo}
                                    {previewHeader}
                                    {config.logoPosition === 'before_items' && previewLogo}
                                    {previewMetadata}
                                    <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }}></div>
                                    {previewItems}
                                    <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }}></div>
                                    {previewTotals}
                                    <div style={{ borderTop: '2px double #000000', margin: '8px 0' }}></div>
                                    {config.logoPosition === 'bottom' && previewLogo}
                                    {previewFooter}
                                  </>
                                );
                              } else if (layout === 'kitchen') {
                                return (
                                  <>
                                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '120%', border: '2px solid #000', padding: '4px', marginBottom: '8px' }}>⚠️ KONYHAI BLOKK ⚠️</div>
                                    {previewMetadata}
                                    {previewCustomer}
                                    <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }}></div>
                                    {previewItems}
                                    <div style={{ borderTop: '2px double #000000', margin: '8px 0' }}></div>
                                  </>
                                );
                              } else {
                                // classic / minimal
                                return (
                                  <>
                                    {config.logoPosition === 'top' && previewLogo}
                                    {previewHeader}
                                    {config.logoPosition === 'before_items' && previewLogo}
                                    <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }}></div>
                                    {previewMetadata}
                                    <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }}></div>
                                    {previewItems}
                                    <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }}></div>
                                    {previewTotals}
                                    {previewCustomer}
                                    <div style={{ borderTop: '2px double #000000', margin: '8px 0' }}></div>
                                    {config.logoPosition === 'bottom' && previewLogo}
                                    {previewFooter}
                                  </>
                                );
                              }
                            })()}

                            {/* Zigzag bottom styling wrapper */}
                            <style>{`
                              .receipt-container::after {
                                content: "";
                                display: block;
                                position: absolute;
                                bottom: -8px;
                                left: 0;
                                width: 100%;
                                height: 8px;
                                background-image: linear-gradient(135deg, #ffffff 4px, transparent 0), linear-gradient(225deg, #ffffff 4px, transparent 0);
                                background-position: left top;
                                background-repeat: repeat-x;
                                background-size: 8px 8px;
                              }
                            `}</style>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Aktív Portál Munkamenetek (Csak ha be van kapcsolva a portál szerver) */}
                    {db.enableStaffPortals !== false && (
                      <div className="admin-card">
                        <span className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Activity size={18} color="#30d158" />
                          Munkatársi Portál Aktív Munkamenetek ({activeSessions.length})
                        </span>
                        <div style={{ marginTop: '10px' }}>
                          {activeSessions.length > 0 ? (
                            <div className="table-container">
                              <table className="admin-table">
                                <thead>
                                  <tr>
                                    <th>Munkatárs</th>
                                    <th>Bejelentkezés</th>
                                    <th>Aktuális Nézet</th>
                                    <th style={{ textAlign: 'right' }}>Műveletek</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeSessions.map((session: WebSession) => {
                                    const user = db.users.find((u: any) => u.id === session.userId);
                                    if (!user) return null;

                                    return (
                                      <tr key={session.userId}>
                                        <td>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                              width: '24px',
                                              height: '24px',
                                              borderRadius: '50%',
                                              background: user.color || '#bf5af2',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}>
                                              {renderUserIcon(user.symbol || 'User', 12, 'white')}
                                            </div>
                                            <span style={{ fontWeight: 600, color: 'white' }}>{user.name}</span>
                                          </div>
                                        </td>
                                        <td>{session.loginTime}</td>
                                        <td>
                                          <span style={{
                                            fontSize: '10px',
                                            background: 'rgba(255,255,255,0.05)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            color: 'white'
                                          }}>
                                            {session.activeView === 'kitchen' ? '👨‍🍳 Konyha' : session.activeView === 'courier' ? '🚗 Futár' : 'Kezdőlap'}
                                          </span>
                                        </td>
                                        <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                          <button
                                            className="btn"
                                            style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(255,159,10,0.15)', color: '#ff9f0a', border: '1px solid rgba(255,159,10,0.2)' }}
                                            onClick={() => handleKickUser(session.userId)}
                                          >
                                            Lecsatlakoztatás
                                          </button>
                                          <button
                                            className="btn"
                                            style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(255,69,58,0.15)', color: '#ff453a', border: '1px solid rgba(255,69,58,0.2)' }}
                                            onClick={() => handleToggleBanUser(session.userId)}
                                          >
                                            Kitiltás
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              Nincsenek aktív bejelentkezett munkatársak a weboldalon.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* TAB: DELIVERY FEES */}
              {adminTab === 'delivery' && (() => {
                const config = db.deliveryFees || { mode: 'manual', baseFee: 500, perKmFee: 100, settlements: [] };
                const mode = config.mode || 'manual';
                const settlements = config.settlements || [];
                
                return (
                  <>
                    <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 className="admin-title">Kiszállítási díj kalkuláció</h2>
                      
                      {/* Segmented Mode Selector */}
                      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <button
                          className={`btn ${mode === 'manual' ? 'btn-primary' : ''}`}
                          style={{ borderRadius: '9px', padding: '6px 14px', fontSize: '12px', border: 'none', background: mode === 'manual' ? 'var(--primary)' : 'transparent', boxShadow: mode === 'manual' ? '0 0 10px rgba(0,113,227,0.3)' : 'none', color: mode === 'manual' ? 'white' : 'rgba(255,255,255,0.6)' }}
                          onClick={() => saveDatabase({ ...db, deliveryFees: { ...config, mode: 'manual' } })}
                        >
                          Manuális beállítás
                        </button>
                        <button
                          className={`btn ${mode === 'google' ? 'btn-primary' : ''}`}
                          style={{ borderRadius: '9px', padding: '6px 14px', fontSize: '12px', border: 'none', background: mode === 'google' ? 'var(--primary)' : 'transparent', boxShadow: mode === 'google' ? '0 0 10px rgba(0,113,227,0.3)' : 'none', color: mode === 'google' ? 'white' : 'rgba(255,255,255,0.6)' }}
                          onClick={() => saveDatabase({ ...db, deliveryFees: { ...config, mode: 'google' } })}
                        >
                          Google API Kulcs
                        </button>
                        <button
                          className={`btn ${mode === 'geoapify' ? 'btn-primary' : ''}`}
                          style={{ borderRadius: '9px', padding: '6px 14px', fontSize: '12px', border: 'none', background: mode === 'geoapify' ? 'var(--primary)' : 'transparent', boxShadow: mode === 'geoapify' ? '0 0 10px rgba(0,113,227,0.3)' : 'none', color: mode === 'geoapify' ? 'white' : 'rgba(255,255,255,0.6)' }}
                          onClick={() => saveDatabase({ ...db, deliveryFees: { ...config, mode: 'geoapify' } })}
                        >
                          Geoapify API Kulcs
                        </button>
                      </div>
                    </div>

                    {mode === 'manual' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Manual Global Params Card */}
                        <div className="admin-card" style={{ maxWidth: '600px' }}>
                          <span className="admin-card-title">Globális szorzók (Távolsági alapú kiszámításhoz)</span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                            <div>
                              <label className="input-label">Alapdíj (FT)</label>
                              <input 
                                type="number" 
                                className="input-field"
                                value={config.baseFee}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, baseFee: parseInt(e.target.value) || 0 }
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <label className="input-label">Kilométer díj (FT/km)</label>
                              <input 
                                type="number" 
                                className="input-field"
                                value={config.perKmFee}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, perKmFee: parseInt(e.target.value) || 0 }
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Settlements Table Card */}
                        <div className="admin-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span className="admin-card-title" style={{ margin: 0 }}>Rögzített Települések Költségei</span>
                            <button
                              className="btn btn-primary"
                              onClick={() => {
                                setNewSettlementZip('');
                                setNewSettlementCity('');
                                setNewSettlementDistance('');
                                setNewSettlementFixedFee('');
                                setEditingSettlement({ id: 'NEW' });
                              }}
                            >
                              <Plus size={16} /> Új Település hozzáadása
                            </button>
                          </div>

                          <div className="table-container">
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Irányítószám</th>
                                  <th>Település</th>
                                  <th>Távolság (km)</th>
                                  <th>Kiszállítási díj</th>
                                  <th style={{ textAlign: 'right' }}>Műveletek</th>
                                </tr>
                              </thead>
                              <tbody>
                                {settlements.map((s: any) => {
                                  const hasFixed = s.fixedFee !== undefined && s.fixedFee !== null && s.fixedFee !== '';
                                  const displayFee = hasFixed 
                                    ? `${Number(s.fixedFee).toLocaleString()} FT (Fix ár)` 
                                    : `${Math.round(Number(s.distanceKm || 0) * (config.perKmFee || 0) + (config.baseFee || 0)).toLocaleString()} FT (${s.distanceKm} km szorzva)`;
                                  
                                  return (
                                    <tr key={s.id}>
                                      <td style={{ fontWeight: 600 }}>{s.zip}</td>
                                      <td>{s.city}</td>
                                      <td>{s.distanceKm !== undefined && s.distanceKm !== '' ? `${s.distanceKm} km` : '-'}</td>
                                      <td style={{ fontWeight: 700, color: hasFixed ? 'var(--success)' : 'white' }}>{displayFee}</td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                                          <button
                                            className="btn"
                                            style={{ padding: '4px 8px', fontSize: '11px' }}
                                            onClick={() => {
                                              setNewSettlementZip(s.zip);
                                              setNewSettlementCity(s.city);
                                              setNewSettlementDistance(s.distanceKm !== undefined ? s.distanceKm : '');
                                              setNewSettlementFixedFee(s.fixedFee !== undefined ? s.fixedFee : '');
                                              setEditingSettlement(s);
                                            }}
                                          >
                                            Szerkeszt
                                          </button>
                                          <button
                                            className="btn btn-danger"
                                            style={{ padding: '4px 8px', fontSize: '11px' }}
                                            onClick={() => {
                                              customConfirm(`Biztosan törölni szeretnéd a(z) ${s.city} települést?`, () => {
                                                const updated = settlements.filter((x: any) => x.id !== s.id);
                                                saveDatabase({
                                                  ...db,
                                                  deliveryFees: { ...config, settlements: updated }
                                                });
                                              });
                                            }}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {settlements.length === 0 && (
                                  <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                                      Nincsenek települések rögzítve. A rendszer az alapdíjgal ({config.baseFee} FT) számol minden kiszállítást.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    )}

                    {mode === 'google' && (
                      <div className="admin-card" style={{ maxWidth: '600px' }}>
                        <span className="admin-card-title">Google Maps API és Kiszámítási Paraméterek</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                          
                          <div>
                            <label className="input-label">Google Distance Matrix API Kulcs</label>
                            <div style={{ position: 'relative' }}>
                              <input 
                                type={showApiKey ? 'text' : 'password'} 
                                className="input-field"
                                value={config.googleApiKey || ''}
                                style={{ paddingRight: '40px' }}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, googleApiKey: e.target.value }
                                  });
                                }}
                                placeholder="AIzaSy..."
                              />
                              <button 
                                type="button"
                                className="btn"
                                onClick={() => setShowApiKey(!showApiKey)}
                                style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', padding: '4px', color: 'var(--text-secondary)' }}
                              >
                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Étkezde címe (Kiindulási Pont / Főhadiszállás)</label>
                            <input 
                              type="text" 
                              className="input-field"
                              value={config.baseAddress || ''}
                              onChange={e => {
                                saveDatabase({
                                  ...db,
                                  deliveryFees: { ...config, baseAddress: e.target.value }
                                });
                              }}
                              placeholder="pl: Zalaegerszeg, Kossuth utca 1."
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="input-label">Alapdíj (FT)</label>
                              <input 
                                type="number" 
                                className="input-field"
                                value={config.baseFee}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, baseFee: parseInt(e.target.value) || 0 }
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <label className="input-label">Távolsági díj (FT/km)</label>
                              <input 
                                type="number" 
                                className="input-field"
                                value={config.perKmFee}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, perKmFee: parseInt(e.target.value) || 0 }
                                  });
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Díj Kerekítése</label>
                            <AppleSelect
                              value={config.rounding || 'exact'}
                              onChange={val => {
                                saveDatabase({
                                  ...db,
                                  deliveryFees: { ...config, rounding: String(val) }
                                });
                              }}
                              options={[
                                { value: 'exact', label: 'Tűpontos (Kerekítés nélkül)' },
                                { value: 'round10', label: 'Kerekítés 10 FT-ra' },
                                { value: 'round100', label: 'Kerekítés 100 FT-ra' }
                              ]}
                              icon={<Activity size={12} />}
                              isOpen={openRoundingDropdown}
                              onToggle={() => setOpenRoundingDropdown(!openRoundingDropdown)}
                              onClose={() => setOpenRoundingDropdown(false)}
                            />
                          </div>

                        </div>
                      </div>
                    )}

                    {mode === 'geoapify' && (
                      <div className="admin-card" style={{ maxWidth: '600px' }}>
                        <span className="admin-card-title">Geoapify API és Kiszámítási Paraméterek</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                          
                          <div>
                            <label className="input-label">Geoapify API Kulcs</label>
                            <div style={{ position: 'relative' }}>
                              <input 
                                type={showApiKey ? 'text' : 'password'} 
                                className="input-field"
                                value={config.geoapifyApiKey || ''}
                                style={{ paddingRight: '40px' }}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, geoapifyApiKey: e.target.value }
                                  });
                                }}
                                placeholder="Geoapify API kulcs..."
                              />
                              <button 
                                type="button"
                                className="btn"
                                onClick={() => setShowApiKey(!showApiKey)}
                                style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', padding: '4px', color: 'var(--text-secondary)' }}
                              >
                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Étkezde címe (Kiindulási Pont / Főhadiszállás)</label>
                            <input 
                              type="text" 
                              className="input-field"
                              value={config.baseAddress || ''}
                              onChange={e => {
                                saveDatabase({
                                  ...db,
                                  deliveryFees: { ...config, baseAddress: e.target.value }
                                });
                              }}
                              placeholder="pl: Zalaegerszeg, Kossuth utca 1."
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="input-label">Alapdíj (FT)</label>
                              <input 
                                type="number" 
                                className="input-field"
                                value={config.baseFee}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, baseFee: parseInt(e.target.value) || 0 }
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <label className="input-label">Távolsági díj (FT/km)</label>
                              <input 
                                type="number" 
                                className="input-field"
                                value={config.perKmFee}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, perKmFee: parseInt(e.target.value) || 0 }
                                  });
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Díj Kerekítése</label>
                            <AppleSelect
                              value={config.rounding || 'exact'}
                              onChange={val => {
                                saveDatabase({
                                  ...db,
                                  deliveryFees: { ...config, rounding: String(val) }
                                });
                              }}
                              options={[
                                { value: 'exact', label: 'Tűpontos (Kerekítés nélkül)' },
                                { value: 'round10', label: 'Kerekítés 10 FT-ra' },
                                { value: 'round100', label: 'Kerekítés 100 FT-ra' }
                              ]}
                              icon={<Activity size={12} />}
                              isOpen={openRoundingDropdown}
                              onToggle={() => setOpenRoundingDropdown(!openRoundingDropdown)}
                              onClose={() => setOpenRoundingDropdown(false)}
                            />
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Minimum Order Amount and Exclusions Settings Card */}
                    <div className="admin-card" style={{ marginTop: '20px', maxWidth: '600px' }}>
                      <span className="admin-card-title">Minimális Rendelési Összeg és Kizárások</span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                        <div>
                          <label className="input-label">Minimális Kiszállítási Összeg (FT)</label>
                          <input 
                            type="number" 
                            className="input-field"
                            value={config.minOrderAmount || ''}
                            onChange={e => {
                              saveDatabase({
                                ...db,
                                deliveryFees: { ...config, minOrderAmount: Math.max(0, parseInt(e.target.value) || 0) }
                              });
                            }}
                            placeholder="pl: 3000"
                          />
                        </div>

                        <div>
                          <label className="input-label" style={{ marginBottom: '8px' }}>Összeg számításából KIZÁRT tételek:</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                              <input 
                                type="checkbox"
                                checked={config.excludePackaging || false}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, excludePackaging: e.target.checked }
                                  });
                                }}
                              />
                              Ételek csomagolása (Packaging fee)
                            </label>

                            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                              <input 
                                type="checkbox"
                                checked={config.excludeDelivery || false}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, excludeDelivery: e.target.checked }
                                  });
                                }}
                              />
                              Kiszállítási díj (Delivery fee)
                            </label>

                            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                              <input 
                                type="checkbox"
                                checked={config.excludeDiscount || false}
                                onChange={e => {
                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, excludeDiscount: e.target.checked }
                                  });
                                }}
                              />
                              Kedvezmény (Discount)
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Free Delivery Settlements Section */}
                    <div className="admin-card" style={{ marginTop: '20px', maxWidth: '600px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span className="admin-card-title" style={{ margin: 0 }}>Ingyenes Kiszállítású Települések</span>
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setNewFreeSettlementZip('');
                            setNewFreeSettlementCity('');
                            setEditingFreeSettlement({ id: 'NEW' });
                          }}
                        >
                          <Plus size={16} /> Új Ingyenes Település
                        </button>
                      </div>

                      <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Irányítószám</th>
                              <th>Település</th>
                              <th style={{ textAlign: 'right' }}>Műveletek</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(config.freeSettlements || []).map((s: any) => (
                              <tr key={s.id}>
                                <td style={{ fontWeight: 600 }}>{s.zip}</td>
                                <td>{s.city}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => {
                                      customConfirm(`Biztosan törölni szeretnéd a(z) ${s.city} települést az ingyenes listáról?`, () => {
                                        const updated = (config.freeSettlements || []).filter((x: any) => x.id !== s.id);
                                        saveDatabase({
                                          ...db,
                                          deliveryFees: { ...config, freeSettlements: updated }
                                        });
                                      });
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {(config.freeSettlements || []).length === 0 && (
                              <tr>
                                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                                  Nincsenek ingyenes települések megadva.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Add Free Settlement Modal Overlay */}
                    {editingFreeSettlement && (
                      <div className="modal-overlay" onClick={() => setEditingFreeSettlement(null)}>
                        <div className="modal-card" style={{ maxWidth: '400px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px' }} onClick={e => e.stopPropagation()}>
                          <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span className="modal-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                              Új Ingyenes Település Hozzáadása
                            </span>
                            <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditingFreeSettlement(null)}>
                              <X size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                              <div>
                                <label className="input-label">Irányítószám</label>
                                <input 
                                  type="text" 
                                  className="input-field"
                                  value={newFreeSettlementZip}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setNewFreeSettlementZip(val);
                                    if (ZALA_ZIP_MAP[val]) {
                                      setNewFreeSettlementCity(ZALA_ZIP_MAP[val]);
                                    }
                                  }}
                                  placeholder="pl: 8900"
                                />
                              </div>
                              <div>
                                <label className="input-label">Település neve</label>
                                <input 
                                  type="text" 
                                  className="input-field"
                                  value={newFreeSettlementCity}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setNewFreeSettlementCity(val);
                                    // Auto-fill ZIP
                                    const foundZip = Object.keys(ZALA_ZIP_MAP).find(k => ZALA_ZIP_MAP[k].toLowerCase() === val.toLowerCase());
                                    if (foundZip) {
                                      setNewFreeSettlementZip(foundZip);
                                    }
                                  }}
                                  placeholder="pl: Zalaegerszeg"
                                />
                              </div>
                            </div>

                            <button
                              className="btn btn-primary"
                              style={{ width: '100%', height: '38px', fontWeight: 600, marginTop: '10px' }}
                              onClick={() => {
                                if (!newFreeSettlementZip.trim() || !newFreeSettlementCity.trim()) {
                                  alert('Kérlek töltsd ki az irányítószámot és a település nevét!');
                                  return;
                                }

                                const list = config.freeSettlements || [];
                                const newId = `FREE-${Date.now()}`;
                                const newObj = {
                                  id: newId,
                                  zip: newFreeSettlementZip.trim(),
                                  city: newFreeSettlementCity.trim()
                                };

                                saveDatabase({
                                  ...db,
                                  deliveryFees: {
                                    ...config,
                                    freeSettlements: [...list, newObj]
                                  }
                                });

                                setEditingFreeSettlement(null);
                              }}
                            >
                              Mentés
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Add/Edit Settlement Modal Overlay */}
                    {editingSettlement && (
                      <div className="modal-overlay" onClick={() => setEditingSettlement(null)}>
                        <div className="modal-card" style={{ maxWidth: '450px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px' }} onClick={e => e.stopPropagation()}>
                          <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span className="modal-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                              {editingSettlement.id === 'NEW' ? 'Új Település hozzáadása' : 'Település szerkesztése'}
                            </span>
                            <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditingSettlement(null)}>
                              <X size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                              <div>
                                <label className="input-label">Irányítószám</label>
                                <input 
                                  type="text" 
                                  className="input-field"
                                  value={newSettlementZip}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setNewSettlementZip(val);
                                    // Auto-fill city from ZALA_ZIP_MAP
                                    if (ZALA_ZIP_MAP[val]) {
                                      setNewSettlementCity(ZALA_ZIP_MAP[val]);
                                    }
                                  }}
                                  placeholder="pl: 8900"
                                />
                              </div>
                              <div>
                                <label className="input-label">Település neve</label>
                                <input 
                                  type="text" 
                                  className="input-field"
                                  value={newSettlementCity}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setNewSettlementCity(val);
                                    // Auto-fill ZIP by city name
                                    const matchedZip = Object.keys(ZALA_ZIP_MAP).find(
                                      key => ZALA_ZIP_MAP[key].toLowerCase() === val.toLowerCase()
                                    );
                                    if (matchedZip) {
                                      setNewSettlementZip(matchedZip);
                                    }
                                  }}
                                  placeholder="pl: Zalaegerszeg"
                                />
                              </div>
                            </div>

                            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '10px', marginTop: '4px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                                Válassz számítási módot: adj meg távolságot (km) VAGY fix kiszállítási díjat!
                              </span>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                  <label className="input-label">Távolság (km)</label>
                                  <input 
                                    type="number" 
                                    className="input-field"
                                    value={newSettlementDistance}
                                    onChange={e => {
                                      setNewSettlementDistance(e.target.value === '' ? '' : parseFloat(e.target.value));
                                      if (e.target.value !== '') {
                                        setNewSettlementFixedFee(''); // Clear other choice
                                      }
                                    }}
                                    placeholder="pl: 6.5"
                                  />
                                </div>
                                <div>
                                  <label className="input-label">Fix díj (FT)</label>
                                  <input 
                                    type="number" 
                                    className="input-field"
                                    value={newSettlementFixedFee}
                                    onChange={e => {
                                      setNewSettlementFixedFee(e.target.value === '' ? '' : parseInt(e.target.value));
                                      if (e.target.value !== '') {
                                        setNewSettlementDistance(''); // Clear other choice
                                      }
                                    }}
                                    placeholder="pl: 1500"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                              <button className="btn" onClick={() => setEditingSettlement(null)}>Mégse</button>
                              <button
                                className="btn btn-primary"
                                onClick={() => {
                                  if (!newSettlementZip.trim() || !newSettlementCity.trim()) {
                                    alert('Az irányítószám és település kitöltése kötelező!');
                                    return;
                                  }
                                  if (newSettlementDistance === '' && newSettlementFixedFee === '') {
                                    alert('Kérlek adj meg egy távolságot (km) VAGY egy fix kiszállítási díjat!');
                                    return;
                                  }

                                  let updated;
                                  if (editingSettlement.id === 'NEW') {
                                    // Add new settlement
                                    const newId = `SET-${Date.now()}`;
                                    const newS = {
                                      id: newId,
                                      zip: newSettlementZip.trim(),
                                      city: newSettlementCity.trim(),
                                      distanceKm: newSettlementDistance !== '' ? Number(newSettlementDistance) : undefined,
                                      fixedFee: newSettlementFixedFee !== '' ? Number(newSettlementFixedFee) : undefined
                                    };
                                    updated = [...settlements, newS];
                                  } else {
                                    // Update existing
                                    updated = settlements.map((x: any) => 
                                      x.id === editingSettlement.id 
                                        ? {
                                            ...x,
                                            zip: newSettlementZip.trim(),
                                            city: newSettlementCity.trim(),
                                            distanceKm: newSettlementDistance !== '' ? Number(newSettlementDistance) : undefined,
                                            fixedFee: newSettlementFixedFee !== '' ? Number(newSettlementFixedFee) : undefined
                                          }
                                        : x
                                    );
                                  }

                                  saveDatabase({
                                    ...db,
                                    deliveryFees: { ...config, settlements: updated }
                                  });
                                  setEditingSettlement(null);
                                }}
                              >
                                Mentés
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* TAB: HISTORY */}
              {adminTab === 'history' && (
                <>
                  <div className="admin-header">
                    <h2 className="admin-title">Rendelési Előzmények (Lezárt)</h2>
                  </div>
                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Rendelés ID</th>
                          <th>Dátum</th>
                          <th>Vevő név</th>
                          <th>Cím</th>
                          <th>Fizetés</th>
                          <th>Kedvezmény</th>
                          <th>Összeg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCompletedOrders.map((o: Order) => (
                          <tr key={o.id}>
                            <td style={{ fontWeight: 600 }}>#{o.id}</td>
                            <td>{new Date(o.created_at).toLocaleString('hu-HU')}</td>
                            <td>{o.customer_name}</td>
                            <td>{o.customer_address}</td>
                            <td>{o.payment_method}</td>
                            <td>{o.discount_percentage}%</td>
                            <td style={{ fontWeight: 700 }}>{o.total_amount.toLocaleString()} FT</td>
                          </tr>
                        ))}
                        {allCompletedOrders.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                              Nincsenek lezárt rendelések az előzményekben.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* TAB: SCHEDULE (BEOSZTÁS) */}
              {adminTab === 'schedule' && (() => {
                const HUNGARIAN_MONTHS = [
                  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
                  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
                ];
                
                const daysInMonth = new Date(scheduleYear, scheduleMonth + 1, 0).getDate();
                const startDayOfWeek = (new Date(scheduleYear, scheduleMonth, 1).getDay() + 6) % 7; // Mon=0, Sun=6
                
                const handlePrevMonth = () => {
                  if (scheduleMonth === 0) {
                    setScheduleMonth(11);
                    setScheduleYear(scheduleYear - 1);
                  } else {
                    setScheduleMonth(scheduleMonth - 1);
                  }
                };
                
                const handleNextMonth = () => {
                  if (scheduleMonth === 11) {
                    setScheduleMonth(0);
                    setScheduleYear(scheduleYear + 1);
                  } else {
                    setScheduleMonth(scheduleMonth + 1);
                  }
                };

                const calendarCells = [];
                for (let i = 0; i < startDayOfWeek; i++) {
                  calendarCells.push(null);
                }
                for (let d = 1; d <= daysInMonth; d++) {
                  calendarCells.push(d);
                }

                // Selected day shifts
                const dayShifts = (db.shifts || []).filter((s: any) => s.date === selectedScheduleDay);

                return (
                  <>
                    <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 className="admin-title" style={{ margin: 0 }}>Munkaidő Beosztás</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.03)', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <input
                          type="checkbox"
                          id="restrict-schedule-check"
                          checked={db.restrictLoginToSchedule || false}
                          onChange={e => saveDatabase({ ...db, restrictLoginToSchedule: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#bf5af2', cursor: 'pointer' }}
                        />
                        <label htmlFor="restrict-schedule-check" style={{ fontSize: '12px', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                          Belépés korlátozása (Csak beosztott munkatársak léphetnek be)
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                      
                      {/* Left: Monthly Calendar Grid */}
                      <div className="admin-card" style={{ flex: 3, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <button className="btn" style={{ padding: '4px 10px' }} onClick={handlePrevMonth}>◀</button>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>
                            {scheduleYear} {HUNGARIAN_MONTHS[scheduleMonth]}
                          </span>
                          <button className="btn" style={{ padding: '4px 10px' }} onClick={handleNextMonth}>▶</button>
                        </div>

                        {/* Calendar Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
                          {['Hé', 'Ke', 'Sze', 'Cs', 'Pé', 'Szo', 'Va'].map(day => (
                            <div key={day} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', padding: '4px 0' }}>
                              {day}
                            </div>
                          ))}

                          {calendarCells.map((dayNum, index) => {
                            if (dayNum === null) {
                              return <div key={`empty-${index}`} style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '6px', height: '70px' }} />;
                            }

                            const cellDateStr = `${scheduleYear}-${String(scheduleMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                            const isSelected = selectedScheduleDay === cellDateStr;
                            const isToday = new Date().toISOString().split('T')[0] === cellDateStr;

                            // Find shifts for this day
                            const cellShifts = (db.shifts || []).filter((s: any) => s.date === cellDateStr);

                            return (
                              <div
                                key={cellDateStr}
                                onClick={() => setSelectedScheduleDay(cellDateStr)}
                                style={{
                                  background: isSelected ? 'rgba(191,90,242,0.15)' : 'rgba(255,255,255,0.03)',
                                  border: isSelected ? '1px solid #bf5af2' : isToday ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--glass-border)',
                                  borderRadius: '6px',
                                  height: '70px',
                                  padding: '6px',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: isToday ? '#64d2ff' : 'white',
                                  background: isToday ? 'rgba(100,210,255,0.15)' : 'transparent',
                                  padding: isToday ? '2px 4px' : '0',
                                  borderRadius: '4px',
                                  width: 'fit-content'
                                }}>
                                  {dayNum}
                                </span>

                                {/* Scheduled users list representation */}
                                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', overflow: 'hidden', height: '32px', alignContent: 'flex-end' }}>
                                  {cellShifts.map((s: any, idx: number) => {
                                    const u = db.users.find((user: any) => user.id === s.userId);
                                    if (!u) return null;
                                    return (
                                      <div
                                        key={idx}
                                        title={`${u.name}: ${s.startTime}-${s.endTime}`}
                                        style={{
                                          width: '10px',
                                          height: '10px',
                                          borderRadius: '50%',
                                          background: u.color || '#bf5af2',
                                          boxShadow: `0 0 5px ${u.color}aa`
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right: Selected Day Shift Editor */}
                      <div className="admin-card" style={{ flex: 2, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#bf5af2', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Kiválasztott Nap</span>
                          <h4 style={{ margin: 0, color: 'white', fontSize: '15px', fontWeight: 600 }}>{selectedScheduleDay}</h4>
                        </div>

                        {/* List shifts */}
                        <div style={{ flex: 1, minHeight: '120px', maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Mai beosztottak ({dayShifts.length}):</span>
                          
                          {dayShifts.map((s: Shift) => {
                            const u = db.users.find((user: any) => user.id === s.userId);
                            if (!u) return null;

                            return (
                              <div
                                key={s.id}
                                style={{
                                  background: 'rgba(255,255,255,0.02)',
                                  border: '1px solid var(--glass-border)',
                                  borderRadius: '6px',
                                  padding: '8px 10px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.color || 'var(--primary)' }} />
                                  <div>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'white' }}>{u.name}</div>
                                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                                      {s.startTime} - {s.endTime} ({s.roles.join(', ')})
                                    </div>
                                  </div>
                                </div>
                                <button
                                  className="btn"
                                  style={{ padding: '2px', background: 'rgba(255,69,58,0.1)', border: 'none', color: '#ff453a' }}
                                  onClick={() => handleDeleteShift(s.id)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })}
                          
                          {dayShifts.length === 0 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', padding: '10px 0' }}>
                              Nincs beosztás mára.
                            </div>
                          )}
                        </div>

                        {/* Shift Creator Form */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>Új Beosztás Hozzáadása</span>
                          
                          <div>
                            <label className="input-label" style={{ fontSize: '10px' }}>Munkatárs</label>
                            <AppleSelect
                              value={newShiftUserId ? String(newShiftUserId) : ''}
                              onChange={val => setNewShiftUserId(val ? Number(val) : '')}
                              options={db.users.map((u: any) => ({
                                value: String(u.id),
                                label: `${u.name} (${u.web_roles?.join(', ') || 'Nincs'})`
                              }))}
                              icon={<User size={12} />}
                              isOpen={openShiftUserDropdown}
                              onToggle={() => setOpenShiftUserDropdown(!openShiftUserDropdown)}
                              onClose={() => setOpenShiftUserDropdown(false)}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label className="input-label" style={{ fontSize: '10px' }}>Kezdés</label>
                              <input
                                type="time"
                                className="input-field"
                                value={newShiftStartTime}
                                onChange={e => setNewShiftStartTime(e.target.value)}
                                style={{ height: '32px', fontSize: '11px', padding: '0 8px' }}
                              />
                            </div>
                            <div>
                              <label className="input-label" style={{ fontSize: '10px' }}>Befejezés</label>
                              <input
                                type="time"
                                className="input-field"
                                value={newShiftEndTime}
                                onChange={e => setNewShiftEndTime(e.target.value)}
                                style={{ height: '32px', fontSize: '11px', padding: '0 8px' }}
                              />
                            </div>
                          </div>

                          <button
                            className="btn btn-primary"
                            onClick={handleAddShift}
                            style={{ background: '#bf5af2', border: 'none', height: '32px', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}
                          >
                            Beosztás Mentése
                          </button>
                        </div>
                      </div>

                    </div>
                  </>
                );
              })()}

              {/* TAB: SETTINGS */}
              {adminTab === 'settings' && (
                <>
                  <div className="admin-header">
                    <h2 className="admin-title">Egyéb Rendszerbeállítások</h2>
                  </div>
                  <div className="admin-card" style={{ maxWidth: '500px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Automatikus biztonsági mentés kilépéskor</span>
                        <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', accentColor: '#bf5af2' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Nyugta automatikus nyomtatása rendeléskor</span>
                        <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', accentColor: '#bf5af2' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                        <span>Üdvözlő belépési animáció engedélyezése</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {db.welcomeAnimationEnabled !== false ? 'Engedélyezve' : 'Kitiltva'}
                          </span>
                          <div 
                            onClick={() => {
                              const nextVal = db.welcomeAnimationEnabled === false;
                              saveDatabase({
                                ...db,
                                welcomeAnimationEnabled: nextVal
                              });
                            }}
                            style={{
                              width: '36px',
                              height: '20px',
                              borderRadius: '10px',
                              background: db.welcomeAnimationEnabled !== false ? '#30d158' : '#ff453a',
                              position: 'relative',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s ease',
                              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
                            }}
                          >
                            <div 
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: 'white',
                                position: 'absolute',
                                top: '2px',
                                left: db.welcomeAnimationEnabled !== false ? '18px' : '2px',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Daily Closes History Card */}
                  <div className="admin-card" style={{ marginTop: '20px', maxWidth: '800px' }}>
                    <span className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <History size={18} color="var(--primary)" />
                      Archivált Napi Zárások Előzménye
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                      {(!db.dailyCloses || db.dailyCloses.length === 0) ? (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px', padding: '10px 0' }}>
                          Még nincsenek lementett napi zárások a rendszerben.
                        </div>
                      ) : (
                        db.dailyCloses.map((close: any) => {
                          const isExpanded = expandedCloseId === close.id;
                          return (
                            <div key={close.id} style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(255,255,255,0.01)' }}>
                              
                              {/* Header row */}
                              <div 
                                onClick={() => setExpandedCloseId(isExpanded ? null : close.id)}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent', transition: 'background 0.2s ease' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Zárás #{close.closeIndex}</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{close.date} {close.closeTime}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                  <span style={{ fontSize: '14px', color: 'white', fontWeight: 600 }}>{close.grossRevenue.toLocaleString()} FT</span>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{close.orderCount} db rendelés</span>
                                  <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)' }} />
                                </div>
                              </div>

                              {/* Expanded details */}
                              {isExpanded && (
                                <div style={{ padding: '16px', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                  
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '16px' }}>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Bruttó:</span>
                                        <strong style={{ color: 'white' }}>{close.grossRevenue.toLocaleString()} FT</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '4px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Nettó:</span>
                                        <strong style={{ color: 'var(--primary)' }}>{close.netRevenue.toLocaleString()} FT</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '4px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Átlagos rendelésköz:</span>
                                        <span style={{ color: 'white' }}>{close.averageOrderGapMin > 0 ? `${close.averageOrderGapMin} perc` : 'N/A'}</span>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Program indítás:</span>
                                        <span style={{ color: 'white', fontWeight: 600 }}>{close.startupTime}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Első rendelés:</span>
                                        <span style={{ color: 'white', fontWeight: 600 }}>{close.firstOrderTime || 'N/A'}</span>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '4px', gap: '2px' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Leghosszabb holtidő:</span>
                                        <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '12px' }}>{close.maxIdleTimeText}</span>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Felhasználók rendelései</span>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '75px', overflowY: 'auto' }}>
                                        {close.usersPerformance?.map((u: any, idx: number) => (
                                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{u.name}:</span>
                                            <strong style={{ color: 'white' }}>{u.count} db</strong>
                                          </div>
                                        ))}
                                        {(!close.usersPerformance || close.usersPerformance.length === 0) && (
                                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nincs adat</span>
                                        )}
                                      </div>
                                    </div>

                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                                    
                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '4px' }}>Ételek</span>
                                      {close.itemsSold?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={75}>
                                          <PieChart>
                                            <Pie
                                              data={close.itemsSold}
                                              cx="50%"
                                              cy="50%"
                                              innerRadius={15}
                                              outerRadius={25}
                                              dataKey="quantity"
                                            >
                                              {close.itemsSold.map((_: any, idx: number) => (
                                                <Cell key={`cell-${idx}`} fill={['#0071e3', '#30d158', '#ff9f0a', '#ff453a', '#af52de', '#5ac8fa', '#ffcc00'][idx % 7]} />
                                              ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${value} db`} contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '9px', padding: '4px' }} />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '25px 0' }}>Nincs</span>
                                      )}
                                    </div>

                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '4px' }}>Csomagolás</span>
                                      {close.packagingSold?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={75}>
                                          <PieChart>
                                            <Pie
                                              data={close.packagingSold}
                                              cx="50%"
                                              cy="50%"
                                              innerRadius={15}
                                              outerRadius={25}
                                              dataKey="quantity"
                                            >
                                              {close.packagingSold.map((_: any, idx: number) => (
                                                <Cell key={`cell-${idx}`} fill={['#30d158', '#ffcc00', '#5ac8fa', '#ff453a'][idx % 4]} />
                                              ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${value} db`} contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '9px', padding: '4px' }} />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '25px 0' }}>Nincs</span>
                                      )}
                                    </div>

                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '4px' }}>Szállítás</span>
                                      {close.deliveries?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={75}>
                                          <PieChart>
                                            <Pie
                                              data={close.deliveries}
                                              cx="50%"
                                              cy="50%"
                                              innerRadius={15}
                                              outerRadius={25}
                                              dataKey="count"
                                            >
                                              {close.deliveries.map((_: any, idx: number) => (
                                                <Cell key={`cell-${idx}`} fill={['#ff9f0a', '#af52de', '#0071e3', '#ff453a'][idx % 4]} />
                                              ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${value} db`} contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '9px', padding: '4px' }} />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '25px 0' }}>Nincs</span>
                                      )}
                                    </div>

                                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '4px' }}>Fizetés</span>
                                      {close.payments?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={75}>
                                          <PieChart>
                                            <Pie
                                              data={close.payments}
                                              cx="50%"
                                              cy="50%"
                                              innerRadius={15}
                                              outerRadius={25}
                                              dataKey="total"
                                            >
                                              {close.payments.map((_: any, idx: number) => (
                                                <Cell key={`cell-${idx}`} fill={['#0071e3', '#30d158', '#ffcc00', '#af52de', '#ff453a'][idx % 5]} />
                                              ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => typeof value === 'number' ? `${value.toLocaleString()} FT` : String(value)} contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '9px', padding: '4px' }} />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '25px 0' }}>Nincs</span>
                                      )}
                                    </div>

                                  </div>

                                </div>
                              )}

                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}

            </section>

          </div>
        )}
        </div>

      </main>

      {/* Bottom Navigation Bar with Chatbot Search Input */}
      <footer className="bottom-navbar">
        <form className="search-bar-container" onSubmit={handleChatSubmit}>
          <Search size={18} className="search-icon-left" />
          <input 
            type="text" 
            className="search-bar" 
            placeholder="Kérdezz a rendszerről, vagy írj be egy rendelést..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onFocus={() => setIsChatbotOpen(true)}
          />
          {chatInput.trim() && (
            <button type="submit" className="search-send-btn">
              <Send size={16} />
            </button>
          )}
        </form>

        {/* Dynamic Island Chatbot Expandable Panel */}
        {isChatbotOpen && (
          <div className="chatbot-island">
            <div className="island-header">
              <span className="island-title">
                <Sparkles size={16} color="var(--primary)" />
                Rendszer Asszisztens Chatbot
              </span>
              <button className="island-close-btn" onClick={() => setIsChatbotOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="island-content">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.sender}`}>
                  <div className={`chat-bubble ${msg.sender}`}>
                    {msg.text.split('\n').map((line, idx) => (
                      <p key={idx} style={{ marginBottom: line ? '6px' : '0' }}>{line}</p>
                    ))}
                  </div>
                  <span className="chat-time">{msg.time}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </footer>


      {/* ================= MODAL: KOSÁR ELEM TESTRESZABÁSA ================= */}
      {editingCartItem && (() => {
        const baseMenuItem = db.items.find((i: any) => i.id === editingCartItem.item_id);
        const basePrice = baseMenuItem ? baseMenuItem.price : editingCartItem.price_at_order;
        const category = baseMenuItem ? db.categories.find((c: any) => c.id === baseMenuItem.category_id) : null;
        const includeAttachmentPackFee = category?.include_linked_packaging_fee && editLinkedItem;
        const basePackFee = baseMenuItem ? baseMenuItem.packaging_fee : editingCartItem.packaging_fee_at_order;
        const packFee = basePackFee + (includeAttachmentPackFee ? editLinkedItem.packaging_fee : 0);

        let extraPrice = 0;
        Object.keys(editIngredientAdjustments).forEach((key) => {
          const ingId = Number(key);
          const adjustment = editIngredientAdjustments[ingId];
          if (adjustment === 'double') {
            const invItem = db.inventory.find((i: any) => i.id === ingId);
            if (invItem) {
              extraPrice += (invItem.double_extra_price || 0);
            }
          }
        });

        const attachmentPrice = editLinkedItem ? editLinkedItem.price : 0;
        const calculatedSinglePrice = Math.round(basePrice * (editPortion === 'half' ? 0.7 : 1.0)) + extraPrice + attachmentPrice;

        // Gather allergens from recipe ingredients
        const allergenNames = new Set<string>();
        if (baseMenuItem && baseMenuItem.ingredients) {
          baseMenuItem.ingredients.forEach((ing: any) => {
            const invItem = db.inventory.find((i: any) => i.id === ing.ingredientId);
            if (invItem) {
              const detected = detectAllergens(invItem.name);
              detected.forEach((a: any) => allergenNames.add(a.name));
            }
          });
        }
        if (baseMenuItem && baseMenuItem.allergens) {
          baseMenuItem.allergens.forEach((a: string) => allergenNames.add(a));
        }
        const allergensList = Array.from(allergenNames);

        const ingredientsList = baseMenuItem ? baseMenuItem.ingredients || [] : [];

        return (
          <div className="modal-overlay" style={{ position: 'fixed', zIndex: 10000 }} onClick={() => setEditingCartItem(null)}>
            <div className="modal-card" style={{ width: baseMenuItem?.category_id && db.categories.find((c: any) => c.id === baseMenuItem.category_id)?.linked_category_id ? '900px' : '480px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">{editingCartItem.name} testreszabása</span>
                <button className="island-close-btn" onClick={() => setEditingCartItem(null)}>
                  <X size={14} />
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Price and Packaging Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Alapár: </span>
                    <strong style={{ color: 'white' }}>{basePrice.toLocaleString()} FT</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Csomagolás: </span>
                    <strong style={{ color: 'white' }}>{packFee.toLocaleString()} FT</strong>
                  </div>
                  {baseMenuItem?.packaging_type && (
                    <div style={{ textTransform: 'capitalize', color: 'var(--primary)', fontWeight: 600 }}>
                      📦 {baseMenuItem.packaging_type}
                    </div>
                  )}
                </div>

                {/* Portion Switch */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="input-label">Adag mérete</label>
                  <div className="portion-switch-container">
                    <div className={`portion-switch-slider ${editPortion}`} />
                    <button 
                      className={`portion-switch-btn ${editPortion === 'full' ? 'active' : ''}`}
                      onClick={() => setEditPortion('full')}
                    >
                      Teljes Adag (100% ár)
                    </button>
                    <button 
                      className={`portion-switch-btn ${editPortion === 'half' ? 'active' : ''}`}
                      onClick={() => setEditPortion('half')}
                    >
                      Fél Adag (70% ár)
                    </button>
                  </div>
                </div>

                {/* Ingredients Recipe List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="input-label" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                    Alapanyagok testreszabása
                  </label>
                  {ingredientsList.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Ennek az ételnek nincsenek külön választható alapanyagai.
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {ingredientsList.map((ing: any) => {
                        const invItem = db.inventory.find((i: any) => i.id === ing.ingredientId);
                        if (!invItem) return null;
                        const adjustment = editIngredientAdjustments[ing.ingredientId] || 'normal';
                        const extraPriceVal = invItem.double_extra_price || 0;

                        return (
                          <div 
                            key={ing.ingredientId} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              padding: '8px 0', 
                              borderBottom: '1px solid rgba(255,255,255,0.03)' 
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: adjustment === 'none' ? 'var(--text-muted)' : 'white', textDecoration: adjustment === 'none' ? 'line-through' : 'none' }}>
                                {invItem.name}
                              </span>
                              {adjustment === 'double' && extraPriceVal > 0 && (
                                <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                                  +{extraPriceVal.toLocaleString()} FT (Dupla adag)
                                </span>
                              )}
                              {adjustment === 'none' && (
                                <span style={{ fontSize: '11px', color: '#ff453a' }}>
                                  Kihagyva a receptből
                                </span>
                              )}
                            </div>

                            {/* Button selector group */}
                            <div 
                              style={{ 
                                display: 'flex', 
                                gap: '2px', 
                                background: 'rgba(255,255,255,0.03)', 
                                padding: '2px', 
                                borderRadius: '8px', 
                                border: '1px solid rgba(255,255,255,0.05)' 
                              }}
                            >
                              <button 
                                className="btn"
                                style={{ 
                                  padding: '4px 10px', 
                                  fontSize: '11px', 
                                  borderRadius: '6px', 
                                  border: 'none',
                                  background: adjustment === 'none' ? 'rgba(255,69,58,0.15)' : 'transparent',
                                  color: adjustment === 'none' ? '#ff453a' : 'var(--text-secondary)',
                                  fontWeight: adjustment === 'none' ? 'bold' : 'normal',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setEditIngredientAdjustments(prev => ({ ...prev, [ing.ingredientId]: 'none' }))}
                              >
                                Kihagy
                              </button>
                              <button 
                                className="btn"
                                style={{ 
                                  padding: '4px 10px', 
                                  fontSize: '11px', 
                                  borderRadius: '6px', 
                                  border: 'none',
                                  background: adjustment === 'normal' ? 'rgba(255,255,255,0.08)' : 'transparent',
                                  color: adjustment === 'normal' ? 'white' : 'var(--text-secondary)',
                                  fontWeight: adjustment === 'normal' ? 'bold' : 'normal',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setEditIngredientAdjustments(prev => ({ ...prev, [ing.ingredientId]: 'normal' }))}
                              >
                                Normál
                              </button>
                              <button 
                                className="btn"
                                style={{ 
                                  padding: '4px 10px', 
                                  fontSize: '11px', 
                                  borderRadius: '6px', 
                                  border: 'none',
                                  background: adjustment === 'double' ? 'rgba(48,209,88,0.15)' : 'transparent',
                                  color: adjustment === 'double' ? '#30d158' : 'var(--text-secondary)',
                                  fontWeight: adjustment === 'double' ? 'bold' : 'normal',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setEditIngredientAdjustments(prev => ({ ...prev, [ing.ingredientId]: 'double' }))}
                              >
                                Dupla
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Note Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="input-label">Egyedi konyhai megjegyzés</label>
                  <textarea 
                    className="input-field"
                    style={{ height: '60px', padding: '8px', fontSize: '12px', resize: 'vertical' }}
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    placeholder="pl: Kevésbé átsütve, szósz a szélére is, tejföllel leöntve..."
                  />
                </div>

                {/* Allergens warning */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="input-label">Étel allergének</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {allergensList.length === 0 ? (
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontStyle: 'italic' }}>
                        ✅ Nem tartalmaz ismert allergént.
                      </span>
                    ) : (
                      allergensList.map(allergen => (
                        <span 
                          key={allergen} 
                          style={{ 
                            background: 'rgba(255,69,58,0.1)', 
                            border: '1px solid rgba(255,69,58,0.2)', 
                            color: '#ff453a', 
                            fontSize: '10px', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontWeight: 600 
                          }}
                        >
                          ⚠️ {allergen}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Linked Category Attachment Selector */}
                {(() => {
                  const itemCat = db.categories.find((c: any) => c.id === baseMenuItem?.category_id);
                  const linkedCat = itemCat ? db.categories.find((c: any) => c.id === itemCat.linked_category_id) : null;
                  if (!linkedCat) return null;

                  const attachmentOptions = db.items.filter((i: any) => i.category_id === linkedCat.id && i.is_active !== false);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label className="input-label">Csatolmány választása ({linkedCat.name})</label>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                        gap: '10px',
                        marginTop: '4px',
                        padding: '2px'
                      }}>
                        {/* Csatolmány nélkül Card */}
                        <div 
                          style={{
                            background: !editLinkedItem ? 'rgba(10, 132, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            border: !editLinkedItem ? '2px solid var(--primary)' : '2px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: '90px',
                            transition: 'all 0.2s ease',
                            boxShadow: !editLinkedItem ? '0 0 8px rgba(10, 132, 255, 0.15)' : 'none'
                          }}
                          onClick={() => setEditLinkedItem(null)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#ff453a' }}>Csatolmány nélkül</span>
                            {!editLinkedItem && <CheckCircle2 size={14} color="var(--primary)" />}
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-muted)' }}>0 FT</span>
                          </div>
                        </div>

                        {/* Linked Items Cards */}
                        {attachmentOptions.map((attItem: MenuItem) => {
                          const isSelected = editLinkedItem?.id === attItem.id;
                          return (
                            <div
                              key={attItem.id}
                              style={{
                                background: isSelected ? 'rgba(10, 132, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                border: isSelected ? '2px solid var(--primary)' : '2px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '10px',
                                padding: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: '90px',
                                transition: 'all 0.2s ease',
                                boxShadow: isSelected ? '0 0 8px rgba(10, 132, 255, 0.15)' : 'none'
                              }}
                              onClick={() => setEditLinkedItem(attItem)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', wordBreak: 'break-word' }}>{attItem.name}</span>
                                {isSelected && <CheckCircle2 size={14} color="var(--primary)" />}
                              </div>
                              <div style={{ marginTop: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>{attItem.price.toLocaleString()} FT</span>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Csomagolás: {attItem.packaging_fee > 0 ? `${attItem.packaging_fee} FT` : 'ingyenes'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Quantity Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="input-label">Rendelési mennyiség</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      type="button"
                      className="btn" 
                      style={{ 
                        width: '36px', 
                        height: '36px', 
                        padding: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'white'
                      }}
                      onClick={() => setEditQuantity(q => Math.max(1, q - 1))}
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      className="input-field" 
                      style={{ 
                        width: '80px', 
                        height: '36px', 
                        textAlign: 'center', 
                        fontSize: '14px', 
                        fontWeight: 'bold',
                        margin: 0
                      }}
                      value={editQuantity}
                      onChange={e => setEditQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <button 
                      type="button"
                      className="btn" 
                      style={{ 
                        width: '36px', 
                        height: '36px', 
                        padding: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'white'
                      }}
                      onClick={() => setEditQuantity(q => q + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Dynamic Price Summary */}
                <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(10, 132, 255, 0.05)', border: '1px solid rgba(10, 132, 255, 0.15)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Egységár: {calculatedSinglePrice.toLocaleString()} FT + Csomagolás: {packFee.toLocaleString()} FT
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Mennyiség: {editQuantity} db
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Összesen (csomagolással)</span>
                    <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
                      {((calculatedSinglePrice + packFee) * editQuantity).toLocaleString()} FT
                    </strong>
                  </div>
                </div>

              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                <button className="btn" onClick={() => setEditingCartItem(null)}>Mégse</button>
                <button className="btn btn-primary" onClick={handleSaveCartItemCustomizations}>
                  Módosítások Alkalmazása
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ================= MODAL: CSATOLT KATEGÓRIA ELEMEK CSATOLÁSA ================= */}
      {attachingMenuItem && (() => {
        const itemCategory = db.categories.find((c: any) => c.id === attachingMenuItem.category_id);
        const linkedCategory = itemCategory ? db.categories.find((c: any) => c.id === itemCategory.linked_category_id) : null;
        if (!linkedCategory) return null;

        const attachmentItems = db.items.filter((i: any) => i.category_id === linkedCategory.id && i.is_active !== false);

        return (
          <div className="modal-overlay" onClick={() => setAttachingMenuItem(null)}>
            <div className="modal-card" style={{ maxWidth: '1000px', width: '90%', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px', display: 'block' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span className="modal-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                  Csatolmány kiválasztása: {attachingMenuItem.name}
                </span>
                <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setAttachingMenuItem(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  A(z) <strong>{itemCategory?.name}</strong> kategóriához csatolva van a(z) <strong>{linkedCategory.name}</strong> kategória. Kérlek válassz egy csatolmányt a lenti kártyák közül, vagy kattints a "Csatolmány nélkül" gombra.
                </span>

                <div>
                  <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>{linkedCategory.name} kiválasztása</label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px',
                    marginTop: '4px',
                    padding: '2px'
                  }}>
                    {/* Csatolmány nélkül Card */}
                    <div 
                      style={{
                        background: !selectedAttachmentItem ? 'rgba(10, 132, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: !selectedAttachmentItem ? '2px solid var(--primary)' : '2px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '100px',
                        transition: 'all 0.2s ease',
                        boxShadow: !selectedAttachmentItem ? '0 0 10px rgba(10, 132, 255, 0.15)' : 'none'
                      }}
                      onClick={() => setSelectedAttachmentItem(null)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ff453a' }}>Csatolmány nélkül</span>
                        {!selectedAttachmentItem && <CheckCircle2 size={16} color="var(--primary)" />}
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-muted)' }}>0 FT</span>
                      </div>
                    </div>

                    {/* Linked Items Cards */}
                    {/* Linked Items Cards */}
                    {attachmentItems.map((attItem: MenuItem) => {
                      const isSelected = selectedAttachmentItem?.id === attItem.id;
                      const pricing = getItemCurrentPricing(attItem, db.categories);
                      const stockStatus = getDishStockStatus(attItem, db.inventory);

                      let cardStyle: React.CSSProperties = {
                        background: isSelected ? 'rgba(10, 132, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected ? '2px solid var(--primary)' : '2px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '100px',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 0 10px rgba(10, 132, 255, 0.15)' : 'none'
                      };

                      if (stockStatus.status === 'out_of_stock') {
                        cardStyle = {
                          ...cardStyle,
                          border: '2px solid #ff453a',
                          boxShadow: '0 0 12px rgba(255, 69, 58, 0.25)',
                          opacity: 0.65,
                          cursor: 'not-allowed'
                        };
                      } else if (stockStatus.status === 'warning') {
                        cardStyle = {
                          ...cardStyle,
                          border: '2px solid #ff9f0a',
                          boxShadow: '0 0 12px rgba(255, 159, 10, 0.2)'
                        };
                      }

                      return (
                        <div
                          key={attItem.id}
                          style={cardStyle}
                          onClick={() => {
                            if (stockStatus.status === 'out_of_stock') {
                              alert(`Nem választható: A(z) "${attItem.name}" termékhez szükséges "${stockStatus.oosIngredient}" alapanyag teljesen elfogyott!`);
                              return;
                            }
                            setSelectedAttachmentItem(attItem);
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', wordBreak: 'break-word' }}>{attItem.name}</span>
                            {isSelected && <CheckCircle2 size={16} color="var(--primary)" />}
                          </div>
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {pricing.price < attItem.price ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '12px', textDecoration: 'line-through', color: 'var(--text-muted)' }}>{attItem.price.toLocaleString()} FT</span>
                                <span style={{ fontSize: '16px', fontWeight: 800, color: '#ff453a' }}>{pricing.price.toLocaleString()} FT</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{pricing.price.toLocaleString()} FT</span>
                            )}
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Csomagolás: {pricing.packagingFee > 0 ? `${pricing.packagingFee} FT` : 'ingyenes'}
                            </div>
                            {stockStatus.status === 'out_of_stock' && (
                              <span style={{ fontSize: '9px', color: '#ff453a', fontWeight: 700 }}>
                                ❌ ELFOGYOTT ({stockStatus.oosIngredient})
                              </span>
                            )}
                            {stockStatus.status === 'warning' && (
                              <span style={{ fontSize: '9px', color: '#ff9f0a', fontWeight: 700 }}>
                                ⚠️ ALACSONY KÉSZLET
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Display Single Item and total price summary */}
                {(() => {
                  const itemCategory = db.categories.find((c: any) => c.id === attachingMenuItem.category_id);
                  const itemPricing = getItemCurrentPricing(attachingMenuItem, db.categories);
                  const attachmentPricing = selectedAttachmentItem ? getItemCurrentPricing(selectedAttachmentItem, db.categories) : null;
                  const includePackFee = itemCategory?.include_linked_packaging_fee && attachmentPricing;
                  const totalPackaging = itemPricing.packagingFee + (includePackFee && attachmentPricing ? attachmentPricing.packagingFee : 0);
                  const totalWithPack = itemPricing.price + (attachmentPricing ? attachmentPricing.price : 0) + totalPackaging;

                  return (
                    <div style={{ marginTop: '6px', padding: '12px', background: 'rgba(10, 132, 255, 0.05)', border: '1px solid rgba(10, 132, 255, 0.15)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Alapár: {itemPricing.price.toLocaleString()} FT + Csomagolás: {itemPricing.packagingFee.toLocaleString()} FT
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Csatolmány: {attachmentPricing ? `+${attachmentPricing.price.toLocaleString()} FT` : 'Nincs (+0 FT)'}
                          {includePackFee && attachmentPricing && ` (Csomagolás: +${attachmentPricing.packagingFee.toLocaleString()} FT)`}
                          {selectedAttachmentItem && !includePackFee && ` (Csomagolás: ingyenes)`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Összesen (csomagolással)</span>
                        <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
                          {totalWithPack.toLocaleString()} FT
                        </strong>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setAttachingMenuItem(null)}>Mégse</button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    addToCartImmediately(attachingMenuItem, selectedAttachmentItem);
                    setAttachingMenuItem(null);
                  }}
                >
                  Kosárba rakás
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ================= MODAL: EGYEDI MEGERŐSÍTÉS (CUSTOM CONFIRM) ================= */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div 
            className="modal-card" 
            style={{ 
              maxWidth: '380px', 
              background: 'var(--panel-bg)', 
              border: '1px solid var(--glass-border)', 
              padding: '20px', 
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'white' }}>{confirmModalTitle}</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{confirmModalMessage}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '6px' }}>
              <button 
                className="btn" 
                onClick={() => setShowConfirmModal(false)}
                style={{ flex: 1, padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}
              >
                Mégse
              </button>
              <button 
                className="btn" 
                onClick={() => {
                  if (onConfirmAction) {
                    onConfirmAction();
                  }
                  setShowConfirmModal(false);
                }}
                style={{ 
                  flex: 1, 
                  padding: '8px 16px', 
                  background: '#ff453a', 
                  color: 'white', 
                  border: '1px solid rgba(255,69,58,0.3)', 
                  borderRadius: '10px', 
                  fontSize: '12px', 
                  fontWeight: 600,
                  boxShadow: '0 0 10px rgba(255,69,58,0.2)'
                }}
              >
                {confirmButtonText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: KEDVEZMÉNY ================= */}
      {showDiscountModal && (
        <div className="modal-overlay" onClick={() => setShowDiscountModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Kedvezmény beállítása</span>
              <button className="island-close-btn" onClick={() => setShowDiscountModal(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body">
              <div>
                <label className="input-label">Százalékos kedvezmény (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="100"
                  className="input-field" 
                  value={discountPercentage} 
                  onChange={e => setDiscountPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} 
                  placeholder="0 - 100"
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {[5, 10, 15, 20, 50].map(pct => (
                  <button 
                    key={pct} 
                    className="btn" 
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setDiscountPercentage(pct)}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setDiscountPercentage(0); setShowDiscountModal(false); }}>Töröl</button>
              <button className="btn btn-primary" onClick={() => setShowDiscountModal(false)}>Alkalmaz</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MENÜ VÁLASZTÓ VARÁZSLÓ ================= */}
      {showMenuWizardModal && wizardCategory && (() => {
        const courses = wizardCategory.courses || [];
        const currentCourse = courses[wizardCourseIndex];
        
        const handleChoice = (itemId: number | null) => {
          let choice: MenuCourseChoice;
          if (itemId === null) {
            choice = {
              courseId: currentCourse.id,
              courseName: currentCourse.name,
              itemId: null,
              itemName: 'Nem kér',
              price: 0,
              packagingFee: 0,
              ingredients: []
            };
          } else {
            const item = db.items.find((i: any) => i.id === itemId);
            if (!item) return;

            const overrides = currentCourse.itemOverrides?.[itemId];
            const pricing = getItemCurrentPricing(item, db.categories);

            const finalPrice = overrides ? overrides.price : pricing.price;
            const finalPackFee = pricing.packagingFee;

            const finalIngredients = overrides && overrides.ingredients 
              ? overrides.ingredients 
              : (item.ingredients || []);

            choice = {
              courseId: currentCourse.id,
              courseName: currentCourse.name,
              itemId: item.id,
              itemName: item.name,
              price: finalPrice,
              packagingFee: finalPackFee,
              ingredients: finalIngredients
            };
          }

          const updatedChoices = [...wizardChoices, choice];
          
          if (wizardCourseIndex + 1 < courses.length) {
            setWizardChoices(updatedChoices);
            setWizardCourseIndex(wizardCourseIndex + 1);
          } else {
            const totalPrice = updatedChoices.reduce((acc, c) => acc + c.price, 0);
            const totalPackaging = updatedChoices.reduce((acc, c) => acc + c.packagingFee, 0);

            const menuCartItem: OrderItem = {
              item_id: -wizardCategory.id,
              name: `${wizardCategory.name}`,
              quantity: 1,
              price_at_order: totalPrice,
              packaging_fee_at_order: totalPackaging,
              custom_modifications: {
                portion: 'full',
                ingredient_adjustments: {},
                note: '',
                extra_price: 0,
                calculated_price: totalPrice,
                is_menu_order: true,
                selected_courses: updatedChoices
              }
            };

            setCart(prev => [...prev, menuCartItem]);
            setShowMenuWizardModal(false);
            setWizardCategory(null);
          }
        };

        if (courses.length === 0) {
          return (
            <div className="modal-overlay" onClick={() => { setShowMenuWizardModal(false); setWizardCategory(null); }}>
              <div className="modal-card" style={{ maxWidth: '400px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{ marginBottom: '14px' }}>
                  <span className="modal-title">{wizardCategory.name}</span>
                </div>
                <div className="modal-body" style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>
                  Ehhez a menüs kategóriához még nincsenek fogások beállítva.
                </div>
                <div className="modal-footer" style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => { setShowMenuWizardModal(false); setWizardCategory(null); }}>Bezárás</button>
                </div>
              </div>
            </div>
          );
        }

        let courseItems: MenuItem[] = [];
        if (currentCourse.sourceType === 'category' && currentCourse.sourceCategoryId) {
          courseItems = db.items.filter((i: any) => i.category_id === currentCourse.sourceCategoryId && i.is_active !== false);
        } else if (currentCourse.sourceType === 'individual' && currentCourse.itemIds) {
          courseItems = db.items.filter((i: any) => currentCourse.itemIds?.includes(i.id) && i.is_active !== false);
        }

        return (
          <div className="modal-overlay" onClick={() => { setShowMenuWizardModal(false); setWizardCategory(null); }}>
            <div className="modal-card" style={{ maxWidth: '700px', width: '90%', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="modal-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                  {wizardCategory.name} választása ({wizardCourseIndex + 1} / {courses.length} Fogás)
                </span>
                <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => { setShowMenuWizardModal(false); setWizardCategory(null); }}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--primary)', fontWeight: 700 }}>
                  Aktuális fogás: {currentCourse.name}
                </h3>
                
                <div style={{ display: 'flex', gap: '6px', margin: '4px 0 10px 0' }}>
                  {courses.map((c, idx) => (
                    <div 
                      key={c.id} 
                      style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '2px',
                        background: idx === wizardCourseIndex ? 'var(--primary)' : (idx < wizardCourseIndex ? 'var(--success)' : 'rgba(255,255,255,0.1)')
                      }}
                    />
                  ))}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '12px',
                  maxHeight: '45vh',
                  overflowY: 'auto',
                  padding: '4px'
                }}>
                  <div 
                    onClick={() => handleChoice(null)}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px dashed rgba(255,69,58,0.4)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      minHeight: '90px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#ff453a' }}>Nem kér</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Fogás kihagyása</span>
                  </div>

                  {courseItems.map((item) => {
                    const overrides = currentCourse.itemOverrides?.[item.id];
                    const pricing = getItemCurrentPricing(item, db.categories);
                    const finalPrice = overrides ? overrides.price : pricing.price;

                    const finalIngredients = overrides && overrides.ingredients 
                      ? overrides.ingredients 
                      : (item.ingredients || []);
                      
                    const stockStatus = getDishStockStatus(item, db.inventory, finalIngredients);

                    let cardStyle: React.CSSProperties = {
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '90px',
                      transition: 'all 0.15s ease'
                    };

                    if (stockStatus.status === 'out_of_stock') {
                      cardStyle = {
                        ...cardStyle,
                        border: '2px solid #ff453a',
                        boxShadow: '0 0 12px rgba(255, 69, 58, 0.25)',
                        opacity: 0.65,
                        cursor: 'not-allowed'
                      };
                    } else if (stockStatus.status === 'warning') {
                      cardStyle = {
                        ...cardStyle,
                        border: '2px solid #ff9f0a',
                        boxShadow: '0 0 12px rgba(255, 159, 10, 0.2)'
                      };
                    }

                    return (
                      <div 
                        key={item.id}
                        onClick={() => {
                          if (stockStatus.status === 'out_of_stock') {
                            alert(`Nem rendelhető: A(z) "${item.name}" ételhez szükséges "${stockStatus.oosIngredient}" alapanyag teljesen elfogyott!`);
                            return;
                          }
                          handleChoice(item.id);
                        }}
                        style={cardStyle}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{item.name}</span>
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                              {finalPrice.toLocaleString()} FT
                            </span>
                          </div>
                          {stockStatus.status === 'out_of_stock' && (
                            <span style={{ fontSize: '9px', color: '#ff453a', fontWeight: 700 }}>
                              ❌ ELFOGYOTT ({stockStatus.oosIngredient})
                            </span>
                          )}
                          {stockStatus.status === 'warning' && (
                            <span style={{ fontSize: '9px', color: '#ff9f0a', fontWeight: 700 }}>
                              ⚠️ ALACSONY KÉSZLET
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  className="btn" 
                  onClick={() => {
                    if (wizardCourseIndex > 0) {
                      setWizardCourseIndex(wizardCourseIndex - 1);
                      setWizardChoices(prev => prev.slice(0, -1));
                    } else {
                      setShowMenuWizardModal(false);
                      setWizardCategory(null);
                    }
                  }}
                >
                  {wizardCourseIndex > 0 ? 'Vissza' : 'Mégse'}
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Eddigi részösszeg: {wizardChoices.reduce((acc, c) => acc + c.price, 0).toLocaleString()} FT
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL: MAI RENDELÉSEK ELŐZMÉNYEI ================= */}
      {showTodayOrdersModal && (
        <div className="modal-overlay" onClick={() => setShowTodayOrdersModal(false)}>
          <div className="modal-card" style={{ maxWidth: '900px', width: '95%', maxHeight: '85vh', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="modal-title" style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} color="var(--primary)" />
                Mai Leadott Rendelések
              </span>
              <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setShowTodayOrdersModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', flex: 1, minHeight: 0 }}>
              {/* Left side: List of today's orders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '4px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                {db.orders && db.orders.filter((o: any) => !o.archived).length > 0 ? (
                  db.orders
                    .filter((o: any) => !o.archived)
                    .map((o: any) => {
                      const isSelected = selectedDetailOrderId === o.id;
                      const courier = db.users.find((u: any) => u.id === o.assigned_courier_id);
                      return (
                        <div
                          key={o.id}
                          onClick={() => setSelectedDetailOrderId(o.id)}
                          style={{
                            background: isSelected ? 'rgba(10, 132, 255, 0.1)' : 'rgba(255,255,255,0.02)',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '13px', color: 'white' }}>{o.customer_name}</strong>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                              {o.total_amount.toLocaleString()} FT
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              📍 {o.customer_address}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                              <span>💳 {o.payment_method}</span>
                              {o.discount_percentage > 0 && (
                                <span style={{ color: 'var(--success)' }}>🏷️ -{o.discount_percentage}%</span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>🚗 Futár: {courier ? courier.name : 'Nincs'}</span>
                              <span>{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                    Nincsenek mai rendelések.
                  </div>
                )}
              </div>

              {/* Right side: Detailed Order View */}
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(() => {
                  if (!selectedDetailOrderId) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '8px' }}>
                        <History size={32} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: '12px', fontStyle: 'italic' }}>Válassz ki egy rendelést a részletek megtekintéséhez!</span>
                      </div>
                    );
                  }
                  const order = db.orders.find((o: any) => o.id === selectedDetailOrderId);
                  if (!order) return null;

                  const courier = db.users.find((u: any) => u.id === order.assigned_courier_id);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <h3 style={{ margin: 0, fontSize: '14px', color: 'white' }}>{order.customer_name}</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Rendelés ID: #{order.id} | {new Date(order.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          📍 <strong>Cím:</strong> {order.customer_address}
                        </div>
                      </div>

                      {/* Meta details grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '12px' }}>
                        <div>
                          <strong>Fizetési mód:</strong> {order.payment_method}
                        </div>
                        <div>
                          <strong>Kedvezmény:</strong> {order.discount_percentage > 0 ? `${order.discount_percentage}%` : 'Nincs'}
                        </div>
                        <div>
                          <strong>Futár:</strong> {courier ? courier.name : 'Nincs kijelölve'}
                        </div>
                        <div>
                          <strong>Felvevő:</strong> {order.created_by_user || 'Nincs adat'}
                        </div>
                        {order.delivery_fee !== undefined && (
                          <div>
                            <strong>Kiszállítási díj:</strong> {order.delivery_fee.toLocaleString()} FT
                          </div>
                        )}
                        <div>
                          <strong>Státusz:</strong> {order.status === 'completed' ? 'Lezárt' : 'Függőben'}
                        </div>
                      </div>

                      {/* Items List */}
                      <div>
                        <label className="input-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Rendelt Tételek</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {order.items.map((item: any, idx: number) => {
                            const portionLabel = item.custom_modifications?.portion === 'half' ? ' (Fél adag)' : '';
                            const mods = item.custom_modifications;
                            const calculatedPrice = mods ? mods.calculated_price : item.price_at_order;
                            
                            return (
                              <div 
                                key={idx} 
                                style={{
                                  background: 'rgba(255,255,255,0.01)',
                                  border: '1px solid rgba(255,255,255,0.04)',
                                  borderRadius: '8px',
                                  padding: '8px 10px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                  <div>
                                    <strong style={{ color: 'white' }}>{item.quantity}x</strong> {item.name}{portionLabel}
                                  </div>
                                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                    {((calculatedPrice + item.packaging_fee_at_order) * item.quantity).toLocaleString()} FT
                                  </span>
                                </div>

                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span>Egységár: {calculatedPrice.toLocaleString()} FT | Csomagolás: {item.packaging_fee_at_order.toLocaleString()} FT</span>
                                  {mods && (
                                    <>
                                      {mods.note && <span>📝 Megjegyzés: "{mods.note}"</span>}
                                      {mods.linked_item && <span>🔗 Csatolmány: {mods.linked_item.name} (+{mods.linked_item.price_at_order.toLocaleString()} FT)</span>}
                                      {mods.ingredient_adjustments && Object.keys(mods.ingredient_adjustments).length > 0 && (
                                        <span>
                                          🥕 Alapanyagok: {
                                            Object.keys(mods.ingredient_adjustments).map(ingId => {
                                              const inv = db.inventory.find((i: any) => i.id === Number(ingId));
                                              const adj = mods.ingredient_adjustments[ingId];
                                              return `${inv ? inv.name : ingId} (${adj === 'none' ? 'Kihagyva' : adj === 'double' ? 'Dupla' : 'Normál'})`;
                                            }).join(', ')
                                          }
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Summary total */}
                      <div style={{
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        paddingTop: '10px',
                        marginTop: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline'
                      }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fizetendő Végösszeg</span>
                        <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>
                          {order.total_amount.toLocaleString()} FT
                        </strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: FIZETÉSI MÓD ================= */}
      {isPaymentViewActive && (
        <div className="modal-overlay" onClick={() => setIsPaymentViewActive(false)}>
          <div className="modal-card" style={{ maxWidth: '850px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700 }}>
                <CreditCard size={20} color="var(--primary)" />
                Fizetési Mód Kiválasztása
              </span>
              <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsPaymentViewActive(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
              {/* Payment options grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {['Készpénz', 'Bankkártya', 'SZÉP Kártya', 'Ajándékutalvány', 'Számla', 'Később fizet', 'Bontott fizetés'].map((method) => {
                  const style = getPaymentMethodStyle(method);
                  const isSelected = paymentMethod === method;
                  return (
                    <div
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method as any);
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: '14px 10px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: isSelected ? style.backgroundColor : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? style.border : '1px solid var(--glass-border)',
                        color: isSelected ? style.color : 'var(--text-secondary)',
                        boxShadow: isSelected ? `0 0 15px ${style.color}33` : 'none',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                      className="payment-card-hover"
                    >
                      {getPaymentMethodIcon(method, 18)}
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{method}</span>
                    </div>
                  );
                })}
              </div>

              {/* Split payment sub-panel */}
              {paymentMethod === 'Bontott fizetés' && (() => {
                // Generate flat items list from cart
                const flatItems: { key: string; itemId: number; name: string; price: number }[] = [];
                cart.forEach((item) => {
                  for (let i = 0; i < item.quantity; i++) {
                    flatItems.push({
                      key: `${item.item_id}-${i}`,
                      itemId: item.item_id,
                      name: item.name,
                      price: item.price_at_order + item.packaging_fee_at_order
                    });
                  }
                });

                const addSplitGroup = () => {
                  const newId = splitGroups.length > 0 ? Math.max(...splitGroups.map(g => g.id)) + 1 : 1;
                  setSplitGroups([...splitGroups, { id: newId, name: `${newId}. Vendég`, paymentMethod: 'Készpénz' }]);
                };

                const removeSplitGroup = (groupId: number) => {
                  if (splitGroups.length <= 1) return;
                  setSplitGroups(splitGroups.filter(g => g.id !== groupId));
                  const firstGroup = splitGroups.find(g => g.id !== groupId);
                  if (firstGroup) {
                    const newAssignments = { ...splitAssignments };
                    Object.keys(newAssignments).forEach(key => {
                      if (newAssignments[key] === groupId) {
                        newAssignments[key] = firstGroup.id;
                      }
                    });
                    setSplitAssignments(newAssignments);
                  }
                };

                return (
                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '15px', display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', flex: 1, minHeight: '300px' }}>
                    
                    {/* Left Column: Item list and assignment */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', minHeight: 0 }}>
                      <h3 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Tételek szétosztása</h3>
                      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '10px', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px' }}>
                        {flatItems.map((item) => {
                          const currentGroupId = splitAssignments[item.key] || splitGroups[0]?.id || 1;
                          return (
                            <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <strong style={{ color: 'white' }}>{item.name}</strong>
                                <span style={{ color: 'var(--text-secondary)' }}>{item.price.toLocaleString()} FT</span>
                              </div>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                {splitGroups.map((g) => {
                                  const isActive = currentGroupId === g.id;
                                  return (
                                    <button
                                      key={g.id}
                                      onClick={() => {
                                        setSplitAssignments({
                                          ...splitAssignments,
                                          [item.key]: g.id
                                        });
                                      }}
                                      style={{
                                        padding: '1px 6px',
                                        fontSize: '10px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: isActive ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                        background: isActive ? 'rgba(0,113,227,0.2)' : 'transparent',
                                        color: isActive ? 'white' : 'var(--text-secondary)',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {g.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Column: Split groups and their totals */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', minHeight: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Számlák (Vendégek)</h3>
                        <button 
                          className="btn btn-primary" 
                          onClick={addSplitGroup}
                          style={{ padding: '2px 8px', fontSize: '11px', height: '26px' }}
                        >
                          <Plus size={12} /> Új vendég
                        </button>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '8px', background: 'rgba(0,0,0,0.2)', maxHeight: '280px' }}>
                        {splitGroups.map((g) => {
                          const assigned = flatItems.filter(item => {
                            const gid = splitAssignments[item.key] || splitGroups[0]?.id || 1;
                            return gid === g.id;
                          });
                          const total = assigned.reduce((sum, item) => sum + item.price, 0);

                          return (
                            <div key={g.id} style={{ background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '6px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="text"
                                    value={g.name}
                                    onChange={(e) => {
                                      setSplitGroups(splitGroups.map(group => group.id === g.id ? { ...group, name: e.target.value } : group));
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      borderBottom: '1px dashed var(--glass-border)',
                                      color: 'white',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      width: '90px',
                                      padding: '2px'
                                    }}
                                  />
                                  {splitGroups.length > 1 && (
                                    <button
                                      onClick={() => removeSplitGroup(g.id)}
                                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                                      title="Vendég törlése"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>

                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', maxHeight: '70px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {assigned.map((item, idx) => (
                                    <div key={`${item.key}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{item.name}</span>
                                      <span>{item.price} FT</span>
                                    </div>
                                  ))}
                                  {assigned.length === 0 && <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Üres</span>}
                                </div>

                              </div>

                              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px', marginTop: '2px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Fizetés:</span>
                                  <AppleSelect
                                    value={g.paymentMethod}
                                    onChange={val => {
                                      setSplitGroups(splitGroups.map(group => group.id === g.id ? { ...group, paymentMethod: String(val) } : group));
                                    }}
                                    options={[
                                      { value: 'Készpénz', label: 'Készpénz' },
                                      { value: 'Bankkártya', label: 'Bankkártya' },
                                      { value: 'SZÉP Kártya', label: 'SZÉP Kártya' },
                                      { value: 'Ajándékutalvány', label: 'Ajándékutalvány' },
                                      { value: 'Számla', label: 'Számla' },
                                      { value: 'Később fizet', label: 'Később fizet' }
                                    ]}
                                    icon={getPaymentMethodIcon(g.paymentMethod, 12)}
                                    isOpen={openSplitPayDropdown === g.id}
                                    onToggle={() => setOpenSplitPayDropdown(openSplitPayDropdown === g.id ? null : g.id)}
                                    onClose={() => setOpenSplitPayDropdown(null)}
                                  />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '12px', color: 'var(--primary)' }}>
                                  <span>Összeg:</span>
                                  <span>{total.toLocaleString()} FT</span>
                                </div>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsPaymentViewActive(false)}>Alkalmaz</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: NAPI ZÁRÁS ================= */}
      {showDailyCloseModal && (() => {
        // Local Calculations
        const activeDayOrders = db.orders ? db.orders.filter((o: any) => !o.archived) : [];
        const completedOrdersToday = activeDayOrders.filter((o: any) => o.status === 'completed');
        const grossRevenueToday = completedOrdersToday.reduce((sum: number, o: any) => sum + o.total_amount, 0);
        const netRevenueToday = Math.round(grossRevenueToday / 1.27);
        const orderCountToday = completedOrdersToday.length;

        const firstOrderTimeToday = (() => {
          const sorted = [...activeDayOrders].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return sorted.length > 0 
            ? new Date(sorted[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Nincs még rendelés';
        })();

        // sold items chart data
        const soldItemsData = (() => {
          const map: { [key: string]: number } = {};
          completedOrdersToday.forEach((o: any) => {
            o.items.forEach((item: any) => {
              map[item.name] = (map[item.name] || 0) + item.quantity;
            });
          });
          return Object.keys(map).map(name => ({ name, value: map[name] }));
        })();

        // packaging chart data
        const soldPackagingData = (() => {
          const map: { [key: string]: number } = {};
          completedOrdersToday.forEach((o: any) => {
            o.items.forEach((item: any) => {
              const menuItem = db.items.find((mi: any) => mi.id === item.item_id);
              const packType = menuItem?.packaging_type || 'none';
              const displayName = packType === 'pizza' ? 'Pizza doboz' : packType === 'box' ? 'Elviteles doboz' : packType === 'cup' ? 'Pohár' : 'Nincs csomagolás';
              map[displayName] = (map[displayName] || 0) + item.quantity;
            });
          });
          return Object.keys(map).map(name => ({ name, value: map[name] }));
        })();

        // delivery destinations data
        const deliveryDestinationsData = (() => {
          const map: { [key: string]: number } = {};
          completedOrdersToday.forEach((o: any) => {
            const city = getCityFromAddress(o.customer_address);
            map[city] = (map[city] || 0) + 1;
          });
          return Object.keys(map).map(name => ({ name, value: map[name] }));
        })();

        // payment methods data
        const paymentMethodsData = (() => {
          const map: { [key: string]: number } = {};
          completedOrdersToday.forEach((o: any) => {
            map[o.payment_method] = (map[o.payment_method] || 0) + o.total_amount;
          });
          return Object.keys(map).map(name => ({ name, value: map[name] }));
        })();

        // users performance list
        const usersPerformanceList = (() => {
          const map: { [key: string]: number } = {};
          completedOrdersToday.forEach((o: any) => {
            const user = o.created_by_user || 'Rendszer';
            map[user] = (map[user] || 0) + 1;
          });
          return Object.keys(map).map(name => ({ name, count: map[name] }));
        })();

        // Average time between orders
        const averageOrderGapMin = (() => {
          const sorted = [...completedOrdersToday].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          if (sorted.length <= 1) return 0;
          let totalDiffMs = 0;
          for (let i = 1; i < sorted.length; i++) {
            totalDiffMs += new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime();
          }
          return Math.round((totalDiffMs / (sorted.length - 1)) / 60000);
        })();

        // Longest idle time without order
        const maxIdleTimeText = (() => {
          const sorted = [...completedOrdersToday].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          if (sorted.length <= 1) return 'N/A';
          let maxGapMs = 0;
          let maxStart = '';
          let maxEnd = '';
          for (let i = 1; i < sorted.length; i++) {
            const start = new Date(sorted[i - 1].created_at);
            const end = new Date(sorted[i].created_at);
            const diff = end.getTime() - start.getTime();
            if (diff > maxGapMs) {
              maxGapMs = diff;
              maxStart = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              maxEnd = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
          const gapMin = Math.round(maxGapMs / 60000);
          return gapMin > 0 ? `${maxStart} - ${maxEnd} (${gapMin} perc)` : 'N/A';
        })();

        const PIE_COLORS = ['#0071e3', '#30d158', '#ff9f0a', '#ff453a', '#af52de', '#5ac8fa', '#ffcc00'];

        return (
          <div className="modal-overlay" onClick={() => setShowDailyCloseModal(false)}>
            <div className="modal-card" style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '24px' }} onClick={e => e.stopPropagation()}>
              
              <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 800 }}>
                  <Clock size={22} color="var(--primary)" />
                  Mai Nap Lezárása & Összesítése (Zárás #{((db.dailyCloses?.length || 0) + 1)})
                </span>
                <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setShowDailyCloseModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: '24px', minHeight: 0 }}>
                
                {/* Left Column: List of standard statistics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Pénzügyi Összegzés</span>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Bruttó forgalom:</span>
                      <strong style={{ fontSize: '18px', color: 'white' }}>{grossRevenueToday.toLocaleString()} FT</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Nettó forgalom (ÁFA nélkül, -27%):</span>
                      <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{netRevenueToday.toLocaleString()} FT</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Összes lezárt rendelés:</span>
                      <strong style={{ fontSize: '14px', color: 'white' }}>{orderCountToday} db</strong>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Időbeli adatok</span>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Program indítása:</span>
                      <span style={{ fontWeight: 600, color: 'white' }}>{startupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Első rendelés leadva:</span>
                      <span style={{ fontWeight: 600, color: 'white' }}>{firstOrderTimeToday}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Zárás időpontja:</span>
                      <span style={{ fontWeight: 600, color: 'white' }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Átlagos rendelésköz:</span>
                      <span style={{ fontWeight: 600, color: 'white' }}>{averageOrderGapMin > 0 ? `${averageOrderGapMin} perc` : 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Leghosszabb holtidő:</span>
                      <span style={{ fontWeight: 600, color: 'var(--warning)', fontSize: '12px' }}>{maxIdleTimeText}</span>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Felhasználók Teljesítménye</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                      {usersPerformanceList.map((u, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{u.name}:</span>
                          <strong style={{ color: 'white' }}>{u.count} rendelés</strong>
                        </div>
                      ))}
                      {usersPerformanceList.length === 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nincs rögzített adat.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: 4 Pie charts representing data */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  
                  {/* Chart 1: Sold Food Items */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Eladott Ételcikkek</span>
                    {soldItemsData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={110}>
                          <PieChart>
                            <Pie
                              data={soldItemsData}
                              cx="50%"
                              cy="50%"
                              innerRadius={25}
                              outerRadius={45}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {soldItemsData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${value} db`} contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '4px', maxHeight: '55px', overflowY: 'auto' }}>
                          {soldItemsData.map((d, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: PIE_COLORS[index % PIE_COLORS.length] }} />
                              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{d.name} ({d.value})</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', height: '110px' }}>Nincs eladott tétel</div>
                    )}
                  </div>

                  {/* Chart 2: Sold Packaging */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Eladott Csomagolás</span>
                    {soldPackagingData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={110}>
                          <PieChart>
                            <Pie
                              data={soldPackagingData}
                              cx="50%"
                              cy="50%"
                              innerRadius={25}
                              outerRadius={45}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {soldPackagingData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${value} db`} contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '4px', maxHeight: '55px', overflowY: 'auto' }}>
                          {soldPackagingData.map((d, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: PIE_COLORS[index % PIE_COLORS.length] }} />
                              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{d.name} ({d.value})</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', height: '110px' }}>Nincs eladott csomagolás</div>
                    )}
                  </div>

                  {/* Chart 3: Delivery addresses */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Kiszállítási Címek</span>
                    {deliveryDestinationsData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={110}>
                          <PieChart>
                            <Pie
                              data={deliveryDestinationsData}
                              cx="50%"
                              cy="50%"
                              innerRadius={25}
                              outerRadius={45}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {deliveryDestinationsData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${value} rendelés`} contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '4px', maxHeight: '55px', overflowY: 'auto' }}>
                          {deliveryDestinationsData.map((d, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: PIE_COLORS[index % PIE_COLORS.length] }} />
                              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{d.name} ({d.value})</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', height: '110px' }}>Nincs kiszállítási cím</div>
                    )}
                  </div>

                  {/* Chart 4: Payment methods */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Fizetési Módok</span>
                    {paymentMethodsData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={110}>
                          <PieChart>
                            <Pie
                              data={paymentMethodsData}
                              cx="50%"
                              cy="50%"
                              innerRadius={25}
                              outerRadius={45}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {paymentMethodsData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => typeof value === 'number' ? `${value.toLocaleString()} FT` : String(value)} contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '4px', maxHeight: '55px', overflowY: 'auto' }}>
                          {paymentMethodsData.map((d, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: PIE_COLORS[index % PIE_COLORS.length] }} />
                              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{d.name} ({d.value.toLocaleString()} FT)</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', height: '110px' }}>Nincs leadott tranzakció</div>
                    )}
                  </div>

                </div>

              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn" onClick={() => setShowDailyCloseModal(false)}>Mégse (Folytatás)</button>
                
                <button 
                  className="btn-finalize-closing" 
                  onClick={() => {
                    setShowDailyCloseModal(false);
                    setIsClosingDayAnimationActive(true);
                  }}
                >
                  Véglegesítés
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ================= MODAL: BRUTAL CLOSING ANIMATION ================= */}
      {isClosingDayAnimationActive && (
        <BrutalClosingAnimation onComplete={finalizeDailyClose} />
      )}

      {/* ================= MODAL: RAKTÁR FELTÖLTÉS ================= */}
      {showRaktarFeltoltesModal && (() => {
        const activeSuppliers = db.suppliers ? db.suppliers.filter((s: any) => s.is_active !== false) : [];
        const activeInventory = db.inventory ? db.inventory.filter((i: any) => i.is_active !== false) : [];

// Handle actual PDF processing and matching
        const readAndProcessPdf = (file: File) => {
          setFeltoltesUploadedFileName(file.name);
          setIsAnalyzingInvoice(true);
          setAnalysisSuccess(false);
          setAnalysisProgress(10);
          setAnalysisStep('Fájl beolvasása...');

          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const dataUrl = e.target?.result as string;
              if (!dataUrl) {
                throw new Error("Nem sikerült beolvasni a fájlt.");
              }
              const base64Data = dataUrl.split(',')[1];

              setAnalysisProgress(35);
              setAnalysisStep('PDF szöveg kinyerése folyamatban...');

              if (!window.electronAPI?.parseInvoicePdf) {
                throw new Error("Az offline PDF-olvasó nem elérhető ebben a környezetben.");
              }

              const result = await window.electronAPI.parseInvoicePdf({ type: 'base64', data: base64Data });
              
              if (!result.success || !result.text) {
                throw new Error(result.error || "Nem sikerült szöveget kinyerni a PDF-ből. Győződj meg róla, hogy digitális számla PDF-et töltesz fel!");
              }

              setAnalysisProgress(70);
              setAnalysisStep('Tételek felismerése és párosítása...');
              
              const rawText = result.text;
              setFeltoltesRawText(rawText);

              // 1. Detect Supplier / Partner
              const cleanSupplierName = (name: string) => {
                return name
                  .toLowerCase()
                  .replace(/[\.\,\-\/]/g, ' ')
                  .replace(/\b(kft|bt|zrt|nyrt|kft\.|bt\.|zrt\.)\b/g, '')
                  .trim();
              };

              let matchedSupplier = (db.suppliers || []).find((s: any) => {
                if (s.is_active === false) return false;
                const cleanS = cleanSupplierName(s.name);
                const cleanTxt = rawText.toLowerCase();
                return cleanS.length >= 3 && cleanTxt.includes(cleanS);
              });

              if (!matchedSupplier) {
                // Fallback to first word (e.g. matching "metro" from "Metro Nagykereskedés")
                matchedSupplier = (db.suppliers || []).find((s: any) => {
                  if (s.is_active === false) return false;
                  const cleanS = cleanSupplierName(s.name);
                  const firstWord = cleanS.split(/\s+/)[0];
                  const cleanTxt = rawText.toLowerCase();
                  return firstWord.length >= 3 && cleanTxt.includes(firstWord);
                });
              }

              if (matchedSupplier) {
                setFeltoltesSupplierId(String(matchedSupplier.id));
              }

              // 2. Detect Invoice Number / Bizonylatszám
              const invoiceNumRegexes = [
                /\b(?:számlaszám|bizonylatszám|sorszám|számla száma|számla sorszáma|számlaazonosító|számla azonosító|sz\.\s*szám|számla\s*sz\.|invoice\s*no\.?|invoice\s*number)\b\s*[:\-\.]?\s*([a-zA-Z0-9\-\/_\(\)]+)/i,
                /\b(?:sz\b\s*[:\-\.]?\s*([a-zA-Z0-9\-\/_\(\)]{5,}))/i
              ];

              let foundInvoiceNum = '';
              for (const regex of invoiceNumRegexes) {
                const match = rawText.match(regex);
                if (match && match[1]) {
                  let potentialNum = match[1].trim();
                  // Remove trailing punctuation
                  potentialNum = potentialNum.replace(/[.,:;\-\/]+$/, '').trim();
                  if (potentialNum.length >= 4 && potentialNum.length <= 30 && !/^(kft|kft\.|zrt|bt|oldal|lap|dátum)$/i.test(potentialNum)) {
                    foundInvoiceNum = potentialNum;
                    break;
                  }
                }
              }

              if (foundInvoiceNum) {
                setFeltoltesInvoiceNum(foundInvoiceNum);
              }

              const aliases = db.invoice_aliases || [];
              const inventory = db.inventory || [];
              
              const parsedItems = parsePdfTextToItems(rawText, inventory, aliases);
              
              if (parsedItems.length === 0) {
                throw new Error("A számlán nem találtunk felismerhető tételeket. Ellenőrizd a számla formátumát!");
              }
              
              setPdfItems(parsedItems);
              
              const initialList = parsedItems
                .filter(item => item.matched_item_id !== null)
                .map(item => ({
                  inventory_item_id: item.matched_item_id as number,
                  name: (db.inventory.find((i: any) => i.id === item.matched_item_id)?.name) || item.raw_name,
                  quantity: item.quantity,
                  unit: item.unit || 'kg'
                }));
                
              setFeltoltesItemsList(initialList);
              setAnalysisProgress(100);
              setIsAnalyzingInvoice(false);
              setAnalysisSuccess(true);
            } catch (error: any) {
              console.error(error);
              alert(`Sikertelen számlaelemzés: ${error.message || "Ismeretlen hiba"}`);
              setIsAnalyzingInvoice(false);
              setFeltoltesUploadedFileName(null);
            }
          };

          reader.onerror = () => {
            alert("Hiba történt a fájl helyi beolvasása során.");
            setIsAnalyzingInvoice(false);
            setFeltoltesUploadedFileName(null);
          };

          reader.readAsDataURL(file);
        };

        const handleMatchChange = (pdfItemId: number, newMatchedId: number | null) => {
          const updatedPdfItems = pdfItems.map(item => {
            if (item.id === pdfItemId) {
              return { ...item, matched_item_id: newMatchedId };
            }
            return item;
          });
          setPdfItems(updatedPdfItems);

          const newList = updatedPdfItems
            .filter(item => item.matched_item_id !== null)
            .map(item => ({
              inventory_item_id: item.matched_item_id as number,
              name: (db.inventory.find((i: any) => i.id === item.matched_item_id)?.name) || item.raw_name,
              quantity: item.quantity,
              unit: item.unit || 'kg'
            }));
          setFeltoltesItemsList(newList);
        };

        const executeFeltoltes = () => {
          if (feltoltesItemsList.length === 0) return;

          const updatedInventory = db.inventory.map((inv: any) => {
            const added = feltoltesItemsList.find(i => i.inventory_item_id === inv.id);
            if (added) {
              return {
                ...inv,
                quantity: inv.quantity + added.quantity,
                last_filled_at: new Date().toISOString(),
                last_filled_by: currentUser?.name || 'Rendszer'
              };
            }
            return inv;
          });

          const fillLog = {
            id: db.inventoryFills ? db.inventoryFills.length + 1 : 1,
            invoice_number: feltoltesInvoiceNum || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            supplier_id: feltoltesSupplierId,
            supplier_name: (db.suppliers || []).find((s: any) => s.id === feltoltesSupplierId)?.name || 'Ismeretlen partner',
            date: new Date().toISOString(),
            user: currentUser?.name || 'Rendszer',
            items: feltoltesItemsList
          };

          const newAliases = [...(db.invoice_aliases || [])];
          pdfItems.forEach(item => {
            if (item.matched_item_id !== null) {
              const exists = newAliases.some(a => a.raw_name.toLowerCase() === item.raw_name.toLowerCase());
              if (!exists) {
                const nextId = newAliases.length > 0 ? Math.max(...newAliases.map(a => a.id)) + 1 : 1;
                newAliases.push({
                  id: nextId,
                  raw_name: item.raw_name,
                  inventory_item_id: item.matched_item_id
                });
              }
            }
          });

          const updatedDb = {
            ...db,
            inventory: updatedInventory,
            inventoryFills: [...(db.inventoryFills || []), fillLog],
            invoice_aliases: newAliases
          };

          saveDatabase(updatedDb);
          setShowFeltoltesSuccessCard(true);
        };

        const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) {
            readAndProcessPdf(file);
          }
        };

        const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (file) {
            readAndProcessPdf(file);
          }
        };

        const handleAddItemManually = () => {
          if (!feltoltesSelectedItem) return;
          if (feltoltesAddQty <= 0) return;

          const exists = feltoltesItemsList.some(item => item.inventory_item_id === feltoltesSelectedItem.id);
          if (exists) {
            setFeltoltesItemsList(prev => prev.map(item => 
              item.inventory_item_id === feltoltesSelectedItem.id 
                ? { ...item, quantity: item.quantity + feltoltesAddQty }
                : item
            ));
          } else {
            setFeltoltesItemsList(prev => [...prev, {
              inventory_item_id: feltoltesSelectedItem.id,
              name: feltoltesSelectedItem.name,
              quantity: feltoltesAddQty,
              unit: feltoltesSelectedItem.unit || 'kg'
            }]);
          }

          setFeltoltesSelectedItem(null);
          setFeltoltesSearchQuery('');
          setFeltoltesAddQty(0);
        };

        // Filter items for autocomplete search
        const filteredSearchItems = activeInventory.filter((inv: any) => {
          if (feltoltesSelectedCategory !== 'all' && inv.category_id !== feltoltesSelectedCategory) return false;
          if (!feltoltesSearchQuery.trim()) return true;
          return inv.name.toLowerCase().includes(feltoltesSearchQuery.toLowerCase());
        });

        const selectedSupplier = (db.suppliers || []).find((s: any) => s.id === feltoltesSupplierId);

        return (
          <div className="modal-overlay" onClick={() => setShowRaktarFeltoltesModal(false)}>
            
            {/* SUCCESS FEEDBACK CARD OVERLAY */}
            {showFeltoltesSuccessCard ? (
              <div className="modal-card" style={{ maxWidth: '480px', width: '90%', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '30px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(48, 209, 88, 0.15)',
                  border: '2px solid #30d158',
                  color: '#30d158',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 0 20px rgba(48, 209, 88, 0.3)',
                  animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
                }}>
                  <Check size={32} strokeWidth={3} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>SIKERES RAKTÁR FELTÖLTÉS!</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                  A beszállított árucikkek sikeresen hozzáadásra kerültek a készlethez. A rendszer naplózta a tranzakciót és az utolsó feltöltő adatait.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '14px', textAlign: 'left', marginBottom: '24px', fontSize: '13px', maxHeight: '160px', overflowY: 'auto' }}>
                  <div style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    Beszállító: <strong style={{ color: 'white' }}>{selectedSupplier?.name || '-'}</strong>
                  </div>
                  <div style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    Számlaszám: <strong style={{ color: 'white' }}>{feltoltesInvoiceNum || '-'}</strong>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {feltoltesItemsList.map((item, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• {item.name}:</span>
                        <strong style={{ color: '#30d158' }}>+{item.quantity} {item.unit}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', height: '38px', fontWeight: 600 }}
                  onClick={() => {
                    setShowRaktarFeltoltesModal(false);
                    setShowFeltoltesSuccessCard(false);
                  }}
                >
                  Mentés & Kész
                </button>
              </div>
            ) : (
              <div className="modal-card" style={{ maxWidth: feltoltesMode === 'auto' && analysisSuccess ? '960px' : '780px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', padding: '24px', transition: 'all 0.3s ease' }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 800, color: 'white' }}>
                    <Package size={22} color="var(--primary)" />
                    Új beszállítás rögzítése & Raktár feltöltés
                  </span>
                  <button className="island-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setShowRaktarFeltoltesModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                {/* Top Row: Partner, Számlaszám */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="input-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Partner / Beszerzési hely</label>
                    <AppleSelect
                      value={feltoltesSupplierId}
                      onChange={(val) => setFeltoltesSupplierId(String(val))}
                      options={activeSuppliers.map((s: any) => ({
                        value: s.id,
                        label: `${s.name} (${s.address || 'Nincs cím'})`
                      }))}
                      icon={<Truck size={14} />}
                      isOpen={feltoltesOpenDropdown === 'supplier'}
                      onToggle={() => setFeltoltesOpenDropdown(feltoltesOpenDropdown === 'supplier' ? null : 'supplier')}
                      onClose={() => setFeltoltesOpenDropdown(null)}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Számlaszám / Bizonylatszám</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="pl: SZ-2026/083"
                        style={{ height: '38px', paddingLeft: '32px', fontSize: '13px' }}
                        value={feltoltesInvoiceNum}
                        onChange={e => setFeltoltesInvoiceNum(e.target.value)}
                      />
                      <FileText size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    </div>
                  </div>
                </div>

                {/* Subtabs Segment Control */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <div className="menu-sliding-toggle-container" style={{ height: '38px', alignItems: 'center' }}>
                    <div 
                      className="menu-sliding-toggle-indicator" 
                      style={{
                        position: 'absolute',
                        top: '4px',
                        bottom: '4px',
                        borderRadius: '25px',
                        transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                        zIndex: 1,
                        left: feltoltesMode === 'manual' ? '4px' : '144px',
                        width: '140px',
                        background: 'linear-gradient(135deg, var(--primary), #0071e3)',
                        boxShadow: '0 0 12px rgba(0, 113, 227, 0.45)'
                      }}
                    />
                    <button 
                      className={`menu-sliding-toggle-btn ${feltoltesMode === 'manual' ? 'active' : ''}`}
                      style={{ width: '140px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                      onClick={() => setFeltoltesMode('manual')}
                    >
                      Kézi feltöltés
                    </button>
                    <button 
                      className={`menu-sliding-toggle-btn ${feltoltesMode === 'auto' ? 'active' : ''}`}
                      style={{ width: '140px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                      onClick={() => setFeltoltesMode('auto')}
                    >
                      Számla beolvasás
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: '16px' }}>
                  
                  {/* MODE: MANUAL */}
                  {feltoltesMode === 'manual' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '4.5fr 5.5fr', gap: '20px' }}>
                      
                      {/* Left Side: Add Form */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', display: 'block', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>Tétel Hozzáadása</span>
                        
                        {/* 1. Category Filter */}
                        <div>
                          <label className="input-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Szűrés Kategória szerint</label>
                          <AppleSelect
                            value={feltoltesSelectedCategory}
                            onChange={(val) => {
                              setFeltoltesSelectedCategory(val === 'all' ? 'all' : Number(val));
                              setFeltoltesSelectedItem(null);
                              setFeltoltesSearchQuery('');
                            }}
                            options={[
                              { value: 'all', label: 'Mindegyik kategória' },
                              ...(db.inventoryCategories || []).map((c: any) => ({ value: c.id, label: c.name }))
                            ]}
                            icon={<Layers size={14} />}
                            isOpen={feltoltesOpenDropdown === 'category'}
                            onToggle={() => setFeltoltesOpenDropdown(feltoltesOpenDropdown === 'category' ? null : 'category')}
                            onClose={() => setFeltoltesOpenDropdown(null)}
                          />
                        </div>

                        {/* 2. Autocomplete Search Input */}
                        <div style={{ position: 'relative' }}>
                          <label className="input-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Raktárcikk keresése</label>
                          <div style={{ position: 'relative' }}>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="Kezdj el gépelni a választáshoz..."
                              style={{ height: '36px', fontSize: '12px', paddingLeft: '32px' }}
                              value={feltoltesSearchQuery}
                              onChange={e => {
                                setFeltoltesSearchQuery(e.target.value);
                                setFeltoltesSearchDropdownOpen(true);
                                setFeltoltesSelectedItem(null);
                              }}
                              onFocus={() => setFeltoltesSearchDropdownOpen(true)}
                            />
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                          </div>

                          {/* Autocomplete Dropdown List */}
                          {feltoltesSearchDropdownOpen && (
                            <div 
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                left: 0,
                                right: 0,
                                background: '#1c1c1e',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '8px',
                                boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
                                maxHeight: '160px',
                                overflowY: 'auto',
                                zIndex: 100
                              }}
                            >
                              {filteredSearchItems.map((inv: any) => (
                                <div 
                                  key={inv.id} 
                                  style={{ padding: '8px 12px', fontSize: '12px', color: 'white', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                                  className="apple-select-option"
                                  onClick={() => {
                                    setFeltoltesSelectedItem(inv);
                                    setFeltoltesSearchQuery(inv.name);
                                    setFeltoltesSearchDropdownOpen(false);
                                  }}
                                >
                                  {inv.name} ({inv.unit})
                                </div>
                              ))}
                              {filteredSearchItems.length === 0 && (
                                <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Nem található raktárcikk
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Selected Indicator info */}
                        {feltoltesSelectedItem && (
                          <div style={{ background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.2)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', color: '#0a84ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Kiválasztva: <strong>{feltoltesSelectedItem.name}</strong></span>
                            <span>Mértékegység: <strong>{feltoltesSelectedItem.unit}</strong></span>
                          </div>
                        )}

                        {/* 3. Quantity input */}
                        <div>
                          <label className="input-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Beszállított mennyiség</label>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="number" 
                              className="input-field" 
                              style={{ height: '36px', fontSize: '13px', paddingRight: '60px' }}
                              value={feltoltesAddQty || ''}
                              onChange={e => setFeltoltesAddQty(parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                            />
                            <span style={{ position: 'absolute', right: '14px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {feltoltesSelectedItem ? feltoltesSelectedItem.unit : 'egység'}
                            </span>
                          </div>
                        </div>

                        <button 
                          className="btn btn-primary" 
                          style={{ height: '36px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}
                          onClick={handleAddItemManually}
                          disabled={!feltoltesSelectedItem || feltoltesAddQty <= 0}
                        >
                          <Plus size={14} /> Hozzáadás a beszállításhoz
                        </button>
                      </div>

                      {/* Right Side: Added Items List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Beszállítási tételek ({feltoltesItemsList.length} db)</span>
                        <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                          <table className="admin-table" style={{ fontSize: '12px' }}>
                            <thead>
                              <tr>
                                <th>Raktárcikk</th>
                                <th>Mennyiség</th>
                                <th style={{ textAlign: 'right' }}>Eltávolítás</th>
                              </tr>
                            </thead>
                            <tbody>
                              {feltoltesItemsList.map((item, index) => (
                                <tr key={index}>
                                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                                  <td style={{ color: '#30d158', fontWeight: 700 }}>+{item.quantity} {item.unit}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button 
                                      style={{ background: 'transparent', border: 'none', color: '#ff453a', cursor: 'pointer', padding: 0 }}
                                      onClick={() => setFeltoltesItemsList(prev => prev.filter((_, i) => i !== index))}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {feltoltesItemsList.length === 0 && (
                                <tr>
                                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                                    Nincsenek még tételek hozzáadva. Használd a bal oldali űrlapot tételek megadásához.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* MODE: AUTOMATIC AI RECEIPT SCAN */}
                  {feltoltesMode === 'auto' && (
                    <div style={{ width: '100%' }}>
                      
                      {/* Case 1: Dropzone UI */}
                      {!feltoltesUploadedFileName && !isAnalyzingInvoice && (
                        <div 
                          onDragOver={e => e.preventDefault()}
                          onDrop={handleFileDrop}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*,application/pdf';
                            input.onchange = (e: any) => handleFileSelect(e);
                            input.click();
                          }}
                          style={{
                            border: '2px dashed var(--glass-border)',
                            borderRadius: '16px',
                            background: 'rgba(255,255,255,0.01)',
                            padding: '48px 24px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          className="dropzone-hover"
                        >
                          <FileText size={48} style={{ color: 'var(--text-secondary)', opacity: 0.6 }} />
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>
                            Húzd ide vagy kattints a számla képének/PDF-jének feltöltéséhez
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Támogatott formátumok: PNG, JPG, PDF • AI automata beolvasás
                          </span>
                        </div>
                      )}

                      {/* Case 2: Analysis loading state */}
                      {isAnalyzingInvoice && (
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                          <div className="spinner" style={{ width: '36px', height: '36px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s infinite linear' }} />
                          <div>
                            <strong style={{ display: 'block', fontSize: '15px', color: 'white', marginBottom: '4px' }}>
                              Számla elemzése folyamatban... ({analysisProgress}%)
                            </strong>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {analysisStep}
                            </span>
                          </div>
                          <div style={{ width: '100%', maxWidth: '320px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${analysisProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), #5ac8fa)', transition: 'width 0.1s linear' }} />
                          </div>
                        </div>
                      )}

                      {/* Case 3: Scan Complete splitscreen */}
                      {analysisSuccess && (
                        <div style={{ display: 'grid', gridTemplateColumns: '4fr 6fr', gap: '20px' }}>
                          
                          {/* Scanned invoice raw text on Left */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Beolvasott számla nyers szövege</span>
                            <div style={{
                              background: '#1c1c1e',
                              color: '#a1a1a6',
                              borderRadius: '12px',
                              padding: '16px',
                              border: '1px solid rgba(255,255,255,0.05)',
                              fontFamily: 'Courier New, monospace',
                              fontSize: '11px',
                              height: '350px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              userSelect: 'text'
                            }}>
                              {feltoltesRawText || 'Nem található olvasható szöveg a PDF-ben.'}
                            </div>
                          </div>

                          {/* Scanned items matching editor list on Right */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Felismert tételek párosítása és jóváhagyása</span>
                            
                            <div className="table-container" style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', maxHeight: '290px', overflowY: 'auto' }}>
                              <table className="admin-table" style={{ fontSize: '12px' }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: '40%' }}>Számla cikk név</th>
                                    <th style={{ width: '35%' }}>Raktári cikk összekötés</th>
                                    <th style={{ width: '25%', textAlign: 'right' }}>Mennyiség</th>
                                    <th style={{ width: '5%', textAlign: 'right' }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pdfItems.map((item) => (
                                    <tr key={item.id}>
                                      <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontWeight: 600, color: 'white', fontSize: '12px' }}>{item.raw_name}</span>
                                          <span style={{ fontSize: '10px', color: item.matched_item_id ? '#30d158' : '#ff9f0a', fontWeight: 500 }}>
                                            {item.matched_item_id ? '✓ Automatikus pár' : '⚠️ Nincs párosítva'}
                                          </span>
                                        </div>
                                      </td>
                                      <td>
                                        <select
                                          className="input-field"
                                          style={{
                                            height: '28px',
                                            fontSize: '11px',
                                            padding: '0 4px',
                                            background: 'rgba(0,0,0,0.4)',
                                            color: 'white',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            width: '100%',
                                            outline: 'none'
                                          }}
                                          value={item.matched_item_id || ''}
                                          onChange={e => {
                                            const val = e.target.value;
                                            handleMatchChange(item.id, val === '' ? null : Number(val));
                                          }}
                                        >
                                          <option value="">-- Válassz cikket --</option>
                                          {db.inventory.filter((inv: any) => inv.is_active !== false).map((inv: any) => (
                                            <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                                          <input 
                                            type="number" 
                                            className="input-field" 
                                            value={item.quantity}
                                            style={{ width: '60px', height: '28px', padding: '2px', fontSize: '11px', textAlign: 'center', borderRadius: '4px' }}
                                            onChange={e => {
                                              const val = parseFloat(e.target.value) || 0;
                                              setPdfItems(prev => prev.map(p => p.id === item.id ? { ...p, quantity: val } : p));
                                              setFeltoltesItemsList(prev => prev.map(p => 
                                                p.inventory_item_id === item.matched_item_id ? { ...p, quantity: val } : p
                                              ));
                                            }}
                                          />
                                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', minWidth: '20px' }}>{item.unit}</span>
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <button 
                                          style={{ background: 'transparent', border: 'none', color: '#ff453a', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                          onClick={() => {
                                            setPdfItems(prev => prev.filter(p => p.id !== item.id));
                                            if (item.matched_item_id) {
                                              setFeltoltesItemsList(prev => prev.filter(p => p.inventory_item_id !== item.matched_item_id));
                                            }
                                          }}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                  {pdfItems.length === 0 && (
                                    <tr>
                                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                                        Nem találtunk feldolgozható tételeket.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Option to clear/re-upload */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Fájl: <strong style={{ color: 'white' }}>{feltoltesUploadedFileName}</strong>
                              </span>
                              <button 
                                className="btn" 
                                style={{ fontSize: '11px', padding: '4px 10px', height: '28px' }}
                                onClick={() => {
                                  setFeltoltesUploadedFileName(null);
                                  setFeltoltesItemsList([]);
                                  setPdfItems([]);
                                  setFeltoltesRawText('');
                                  setAnalysisSuccess(false);
                                }}
                              >
                                Új számla feltöltése
                              </button>
                            </div>
                          </div>

                        </div>
                      )}


                    </div>
                  )}

                </div>

                {/* Footer buttons */}
                <div className="modal-footer" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button className="btn" onClick={() => setShowRaktarFeltoltesModal(false)}>Mégse</button>
                  <button 
                    className="btn btn-primary"
                    style={{ 
                      height: '38px', 
                      padding: '0 20px', 
                      fontWeight: 600, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      boxShadow: feltoltesItemsList.length > 0 ? '0 0 12px rgba(0, 113, 227, 0.4)' : 'none'
                    }}
                    onClick={executeFeltoltes}
                    disabled={feltoltesItemsList.length === 0}
                  >
                    Feltöltés végrehajtása
                  </button>
                </div>

              </div>
            )}

          </div>
        );
      })()}

      <style>{`
        /* Staggered Apple-style Entrance Animation */
        @keyframes appleEntrance {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .entrance-animating .top-navbar {
          animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .entrance-animating .side-panel {
          animation: appleEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
        }

        .entrance-animating .side-panel.right {
          animation: appleEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }

        .entrance-animating .menu-section-title {
          animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
        }

        /* Staggered category card entry */
        .entrance-animating .category-card:nth-child(1) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both; }
        .entrance-animating .category-card:nth-child(2) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both; }
        .entrance-animating .category-card:nth-child(3) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.16s both; }
        .entrance-animating .category-card:nth-child(4) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.20s both; }
        .entrance-animating .category-card:nth-child(5) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.24s both; }
        .entrance-animating .category-card:nth-child(n+6) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.28s both; }

        /* Staggered menu item card entry */
        .entrance-animating .item-card:nth-child(1) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both; }
        .entrance-animating .item-card:nth-child(2) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.11s both; }
        .entrance-animating .item-card:nth-child(3) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.14s both; }
        .entrance-animating .item-card:nth-child(4) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.17s both; }
        .entrance-animating .item-card:nth-child(5) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.20s both; }
        .entrance-animating .item-card:nth-child(6) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.23s both; }
        .entrance-animating .item-card:nth-child(7) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.26s both; }
        .entrance-animating .item-card:nth-child(8) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.29s both; }
        .entrance-animating .item-card:nth-child(n+9) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.32s both; }

        /* Cart items staggering */
        .entrance-animating .cart-item:nth-child(1) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both; }
        .entrance-animating .cart-item:nth-child(2) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.16s both; }
        .entrance-animating .cart-item:nth-child(3) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.20s both; }
        .entrance-animating .cart-item:nth-child(n+4) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.24s both; }

        /* Active orders list cards staggering */
        .entrance-animating .order-card:nth-child(1) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.10s both; }
        .entrance-animating .order-card:nth-child(2) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.14s both; }
        .entrance-animating .order-card:nth-child(3) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.18s both; }
        .entrance-animating .order-card:nth-child(n+4) { animation: appleEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.22s both; }

        /* Bottom search bar */
        .entrance-animating .bottom-navbar {
          animation: appleEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.18s both;
        }

        /* Animated Login Background Orbs */
        .login-view {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: #000000;
          overflow: hidden;
          z-index: 1;
        }

        .login-bg-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          z-index: 0;
          pointer-events: none;
        }

        .login-orb {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.22;
          mix-blend-mode: screen;
          animation: rotateOrb 25s infinite alternate ease-in-out;
        }

        .login-orb-1 {
          background: #0071e3;
          top: -150px;
          left: -100px;
          animation-duration: 22s;
        }

        .login-orb-2 {
          background: #bf5af2;
          bottom: -200px;
          right: -100px;
          animation-duration: 28s;
          animation-delay: -7s;
        }

        .login-orb-3 {
          background: #ff453a;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 350px;
          height: 350px;
          opacity: 0.10;
          animation-duration: 20s;
          animation-delay: -12s;
        }

        @keyframes rotateOrb {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          50% {
            transform: translate(80px, 40px) rotate(180deg) scale(1.15);
          }
          100% {
            transform: translate(-40px, -60px) rotate(360deg) scale(0.95);
          }
        }

        /* Glassmorphism login card */
        .login-card {
          position: relative;
          z-index: 10;
          background: rgba(22, 22, 23, 0.45);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg);
          padding: 40px;
          width: 400px;
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          animation: loginCardEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes loginCardEntrance {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Login error shake animation */
        .login-card-shake {
          animation: appleShake 0.4s ease-in-out !important;
        }

        @keyframes appleShake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-8px); }
          30%, 60%, 90% { transform: translateX(8px); }
        }

        /* Logo badge */
        .login-logo-orb {
          width: 52px;
          height: 52px;
          border-radius: 15px;
          background: linear-gradient(135deg, rgba(0, 113, 227, 0.15) 0%, rgba(191, 90, 242, 0.15) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 18px auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .logo-inner-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0071e3 0%, #bf5af2 100%);
          animation: pulseDot 2s infinite alternate ease-in-out;
        }

        @keyframes pulseDot {
          from {
            transform: scale(0.85);
            filter: drop-shadow(0 0 2px rgba(191, 90, 242, 0.4));
          }
          to {
            transform: scale(1.1);
            filter: drop-shadow(0 0 6px rgba(0, 113, 227, 0.7));
          }
        }

        /* Form error badge */
        .login-error-badge {
          background: rgba(255, 69, 58, 0.12);
          border: 1px solid rgba(255, 69, 58, 0.2);
          color: #ff453a;
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          font-size: 13px;
          text-align: center;
          margin-bottom: 18px;
          font-weight: 500;
          animation: appleEntrance 0.3s ease-out;
        }

        /* Dynamic submit button */
        .btn-login-submit {
          width: 100%;
          height: 42px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          margin-top: 22px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        /* Disabled submit state */
        .btn-login-submit.disabled {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Active submit state */
        .btn-login-submit.active {
          background: linear-gradient(135deg, #0071e3 0%, #bf5af2 50%, #ff453a 100%);
          background-size: 200% 200%;
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0, 113, 227, 0.25);
          animation: gradientMove 3s ease infinite;
        }

        .btn-login-submit.active:hover {
          transform: translateY(-1px) scale(1.015);
          box-shadow: 0 6px 20px rgba(191, 90, 242, 0.4);
        }

        .btn-login-submit.active:active {
          transform: translateY(1px) scale(0.985);
        }

        /* Error submit state */
        .btn-login-submit.error {
          background: linear-gradient(135deg, #ff453a 0%, #ff3b30 100%);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(255, 69, 58, 0.35);
        }

        /* Exit transition on login success */
        .login-card-fadeout {
          animation: loginCardExit 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }

        @keyframes loginCardExit {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
          to {
            opacity: 0;
            transform: translateY(-30px) scale(0.95);
            filter: blur(8px);
          }
        }

        /* Correct credentials green ripple wave */
        .login-green-ripple {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: var(--radius-lg);
          border: 3px solid #30d158;
          box-shadow: 0 0 35px rgba(48, 209, 88, 0.6), inset 0 0 25px rgba(48, 209, 88, 0.4);
          pointer-events: none;
          z-index: 100;
          animation: greenRipplePlay 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes greenRipplePlay {
          0% {
            transform: scale(0.98);
            opacity: 0.85;
          }
          100% {
            transform: scale(1.16);
            opacity: 0;
          }
        }

        /* Liquid Glass Siri Card styles */
        .login-card.success-liquid {
          border-color: rgba(48, 209, 88, 0.4) !important;
          background: rgba(12, 34, 18, 0.45) !important;
          animation: siriPulse 2.5s infinite ease-in-out;
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6), 
                      0 0 35px rgba(48, 209, 88, 0.25),
                      inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
        }

        .login-liquid-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          border-radius: var(--radius-lg);
          z-index: 0;
          pointer-events: none;
        }

        .login-liquid-blob {
          position: absolute;
          width: 250px;
          height: 250px;
          filter: blur(50px);
          mix-blend-mode: screen;
          opacity: 0.45;
        }

        .login-liquid-blob.blob-1 {
          background: radial-gradient(circle, #30d158 0%, rgba(48, 209, 88, 0) 70%);
          top: -60px;
          left: -60px;
          animation: floatBlob1 8s infinite alternate ease-in-out, morphLiquid 6s infinite ease-in-out;
        }

        .login-liquid-blob.blob-2 {
          background: radial-gradient(circle, #34c759 0%, rgba(52, 199, 89, 0) 70%);
          bottom: -70px;
          right: -60px;
          animation: floatBlob2 10s infinite alternate ease-in-out, morphLiquid 8s infinite ease-in-out;
        }

        .login-liquid-blob.blob-3 {
          background: radial-gradient(circle, #00c7be 0%, rgba(0, 199, 190, 0) 70%);
          top: 35%;
          left: 25%;
          width: 200px;
          height: 200px;
          animation: floatBlob3 11s infinite alternate ease-in-out, morphLiquid 7s infinite ease-in-out;
        }

        @keyframes morphLiquid {
          0%, 100% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; }
          50% { border-radius: 70% 30% 52% 48% / 60% 40% 60% 40%; }
        }

        @keyframes floatBlob1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(60px, 50px) scale(1.25); }
        }

        @keyframes floatBlob2 {
          0% { transform: translate(0, 0) scale(1.15); }
          100% { transform: translate(-50px, -60px) scale(0.85); }
        }

        @keyframes floatBlob3 {
          0% { transform: translate(0, 0) scale(0.9); }
          100% { transform: translate(40px, -40px) scale(1.2); }
        }

        @keyframes siriPulse {
          0%, 100% { box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6), 0 0 30px rgba(48, 209, 88, 0.2); }
          50% { box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6), 0 0 45px rgba(48, 209, 88, 0.45); }
        }

        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
