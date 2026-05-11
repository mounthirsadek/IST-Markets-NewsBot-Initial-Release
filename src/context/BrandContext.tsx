import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BrandConfig, getBrand, DEFAULT_BRAND_ID } from '../data/brands';

interface BrandState {
  activeBrandId: string;
  activeBrand: BrandConfig;
  setActiveBrand: (id: string) => void;
}

export const useBrandStore = create<BrandState>()(
  persist(
    (set) => ({
      activeBrandId: DEFAULT_BRAND_ID,
      activeBrand: getBrand(DEFAULT_BRAND_ID),
      setActiveBrand: (id: string) =>
        set({ activeBrandId: id, activeBrand: getBrand(id) }),
    }),
    { name: 'active-brand' }
  )
);
