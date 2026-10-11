import { ShopSettings } from '../types';
import { SHOP_NAME, SHOP_ADDRESS, SHOP_PHONES, SHOP_DEFAULT_LOGO } from './constants';
import { fsdb } from './firebase';

export const SHOP_SETTINGS_STORAGE_KEY = 'maktabati_shop_settings_v1';

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  shopName: SHOP_NAME || 'مكتبة فكرة',
  slogan: 'للأدوات المكتبية والمدرسية والخدمات الطلابية والتصوير',
  address: SHOP_ADDRESS || 'نادي الياسمين واحد — مدينة المستقبل',
  phones: SHOP_PHONES || 'تليفون وواتس: 01001515297 / 01002226173',
  logoUrl: SHOP_DEFAULT_LOGO,
  commercialReg: '',
  taxNumber: '',
  // Thermal Receipt Defaults
  thermalPaperWidth: '80mm',
  showLogoOnThermal: true,
  showQrOnThermal: true,
  showBarcodeOnThermal: true,
  thermalHeaderNote: 'أهلاً وسهلاً بكم في مكتبتنا',
  thermalFooterNote: 'نسعد دائماً بزيارتكم وخدمتكم!',
  returnPolicyTerms: 'البضاعة المباعة تستبدل أو تسترد خلال 14 يوماً من تاريخ الفاتورة مع إحضار أصل الفاتورة وبحالتها الأصلية. الكتب والأوراق لا ترد بعد فك التغليف.',
  thermalFontSize: 'normal',
  // A4 Invoice Defaults
  showLogoOnA4: true,
  showBankDetailsOnA4: false,
  bankDetails: 'فودافون كاش / إنستاباي: 01001515297',
  a4HeaderNote: 'فاتورة ضريبية / مبيعات رسمية',
  a4FooterTerms: '• البضاعة المباعة تستبدل أو تسترد خلال 14 يوماً من تاريخ الشراء بشرط سلامة المنتج والغلاف.\n• الكتب الخارجية وأوراق التصوير لا تسترد بعد الكتابة عليها أو فك تغليفها الأصلي.'
};

let cachedSettings: ShopSettings | null = null;

export function getShopSettings(): ShopSettings {
  if (cachedSettings) return cachedSettings;

  try {
    const raw = localStorage.getItem(SHOP_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedSettings = { ...DEFAULT_SHOP_SETTINGS, ...parsed };
      return cachedSettings;
    }
  } catch (err) {
    console.error('Error reading shop settings from localStorage:', err);
  }

  cachedSettings = { ...DEFAULT_SHOP_SETTINGS };
  return cachedSettings;
}

export function updateLocalShopSettings(settings: Partial<ShopSettings>): ShopSettings {
  const current = getShopSettings();
  const updated: ShopSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString()
  };
  cachedSettings = updated;
  try {
    localStorage.setItem(SHOP_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error writing shop settings to localStorage:', err);
  }
  return updated;
}

export async function saveShopSettingsToCloud(settings: ShopSettings): Promise<void> {
  updateLocalShopSettings(settings);
  try {
    await fsdb.collection('appSettings').doc('shop').set({
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync shop settings to Firestore immediately (will keep local):', err);
  }
}

export async function fetchShopSettingsFromCloud(): Promise<ShopSettings> {
  try {
    const snap = await fsdb.collection('appSettings').doc('shop').get();
    if (snap.exists) {
      const data = snap.data() as Partial<ShopSettings>;
      const merged: ShopSettings = { ...DEFAULT_SHOP_SETTINGS, ...data };
      updateLocalShopSettings(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Error fetching shop settings from cloud:', err);
  }
  return getShopSettings();
}
