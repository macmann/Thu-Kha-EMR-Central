import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createDoctor,
  createUserAccount,
  getClinicConfiguration,
  assignUserToActiveTenant,
  listDoctors,
  listUsers,
  updateClinicConfiguration,
  updateDoctor,
  updateUserAccount,
  removeUserFromActiveTenant,
  type CreateUserPayload,
  type Doctor,
  type UpdateClinicConfigurationPayload,
  type UpdateDoctorPayload,
  type UpdateUserPayload,
  type UserAccount,
} from '../api/client';
import { useAuth } from './AuthProvider';
import { useTenant } from '../contexts/TenantContext';

interface SettingsContextType {
  appName: string;
  logo: string | null;
  contactAddress: string | null;
  contactPhone: string | null;
  users: UserAccount[];
  doctors: Doctor[];
  updateSettings: (data: UpdateClinicConfigurationPayload) => Promise<void>;
  addUser: (user: CreateUserPayload) => Promise<UserAccount>;
  updateUser: (id: string, data: UpdateUserPayload) => Promise<UserAccount>;
  addDoctor: (doctor: { name: string; department: string }) => Promise<Doctor>;
  updateDoctor: (doctorId: string, data: UpdateDoctorPayload) => Promise<Doctor>;
  refreshDoctors: () => Promise<void>;
  widgetEnabled: boolean;
  setWidgetEnabled: (enabled: boolean) => void;
  assignExistingUser: (userId: string) => Promise<UserAccount>;
  removeUserFromClinic: (userId: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appName, setAppName] = useState<string>('EMR System');
  const [logo, setLogo] = useState<string | null>(null);
  const [contactAddress, setContactAddress] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [widgetEnabled, setWidgetEnabledState] = useState<boolean>(false);
  const { accessToken } = useAuth();
  const { activeTenant } = useTenant();

  const loadDoctors = async () => {
    const data = await listDoctors();
    setDoctors(data);
  };

  useEffect(() => {
    if (!accessToken || !activeTenant) {
      setAppName('EMR System');
      setLogo(null);
      setContactAddress(null);
      setContactPhone(null);
      setWidgetEnabledState(false);
      return;
    }

    let active = true;
    getClinicConfiguration()
      .then((configuration) => {
        if (!active) return;
        setAppName(configuration.appName || 'EMR System');
        setLogo(configuration.logo ?? null);
        setContactAddress(configuration.contactAddress ?? null);
        setContactPhone(configuration.contactPhone ?? null);
        setWidgetEnabledState(Boolean(configuration.widgetEnabled));
      })
      .catch(() => {
        if (!active) return;
        setAppName('EMR System');
        setLogo(null);
        setContactAddress(null);
        setContactPhone(null);
        setWidgetEnabledState(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeTenant]);

  useEffect(() => {
    if (!accessToken || !activeTenant) {
      setDoctors([]);
      return;
    }

    let active = true;
    loadDoctors()
      .then(() => {
        if (!active) return;
      })
      .catch(() => {
        if (!active) return;
        setDoctors([]);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeTenant]);

  useEffect(() => {
    if (!accessToken || !activeTenant) {
      setUsers([]);
      return;
    }

    let active = true;
    listUsers()
      .then((data) => {
        if (!active) return;
        setUsers(data);
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeTenant]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = appName || 'EMR System';
    }
  }, [appName]);

  const updateSettings = async (data: UpdateClinicConfigurationPayload) => {
    const payload: UpdateClinicConfigurationPayload = {};

    if (data.appName !== undefined) {
      payload.appName = data.appName;
    }

    if (data.logo !== undefined) {
      payload.logo = data.logo;
    }

    if (data.widgetEnabled !== undefined) {
      payload.widgetEnabled = data.widgetEnabled;
    }

    if (data.contactAddress !== undefined) {
      payload.contactAddress = data.contactAddress;
    }

    if (data.contactPhone !== undefined) {
      payload.contactPhone = data.contactPhone;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    const updated = await updateClinicConfiguration(payload);
    setAppName(updated.appName || 'EMR System');
    setLogo(updated.logo ?? null);
    setContactAddress(updated.contactAddress ?? null);
    setContactPhone(updated.contactPhone ?? null);
    setWidgetEnabledState(Boolean(updated.widgetEnabled));
  };

  const addUser = async (user: CreateUserPayload) => {
    const created = await createUserAccount(user);
    setUsers((prev) => [...prev, created].sort((a, b) => a.email.localeCompare(b.email)));
    return created;
  };

  const updateUser = async (id: string, data: UpdateUserPayload) => {
    const updated = await updateUserAccount(id, data);
    setUsers((prev) =>
      prev
        .map((item) => (item.userId === id ? updated : item))
        .sort((a, b) => a.email.localeCompare(b.email)),
    );
    return updated;
  };

  const assignExistingUser = async (userId: string) => {
    const assigned = await assignUserToActiveTenant(userId);
    setUsers((prev) => [...prev, assigned].sort((a, b) => a.email.localeCompare(b.email)));
    return assigned;
  };

  const removeUserFromClinic = async (userId: string) => {
    await removeUserFromActiveTenant(userId);
    setUsers((prev) => prev.filter((user) => user.userId !== userId));
  };

  const addDoctor = async (doctor: { name: string; department: string }) => {
    const created = await createDoctor(doctor);
    setDoctors((prev) => [...prev, created]);
    return created;
  };

  const updateDoctorDetails = async (doctorId: string, data: UpdateDoctorPayload) => {
    const updated = await updateDoctor(doctorId, data);
    setDoctors((prev) => prev.map((doctor) => (doctor.doctorId === doctorId ? updated : doctor)));
    return updated;
  };

  const setWidgetEnabled = (enabled: boolean) => {
    setWidgetEnabledState(enabled);
  };

  return (
    <SettingsContext.Provider
      value={{
        appName,
        logo,
        contactAddress,
        contactPhone,
        users,
        doctors,
        refreshDoctors: loadDoctors,
        updateSettings,
        addUser,
        updateUser,
        addDoctor,
        updateDoctor: updateDoctorDetails,
        widgetEnabled,
        setWidgetEnabled,
        assignExistingUser,
        removeUserFromClinic,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};

