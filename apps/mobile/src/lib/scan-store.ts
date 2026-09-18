import { create } from "zustand";

interface ScanState {
  receiverDeviceId: string | null;
  setReceiverDeviceId: (id: string | null) => void;
}

export const useScanStore = create<ScanState>((set) => ({
  receiverDeviceId: null,
  setReceiverDeviceId: (receiverDeviceId) => set({ receiverDeviceId }),
}));
