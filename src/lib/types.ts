export type EventTypeDTO = {
  id: string;
  code: string;
  name: string;
  color: string;
  dailyMaxCapacity: number;
  active: boolean;
  sortOrder: number;
};

export type ReservationDTO = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  eventTypeId: string;
  eventType: { id: string; code: string; name: string; color: string; dailyMaxCapacity: number };
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string | null;
  peopleCount: number;
  notes: string | null;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
};

export type UserDTO = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  active: boolean;
  createdAt: string;
};
