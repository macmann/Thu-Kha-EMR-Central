import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createDoctor,
  createUserAccount,
  getClinicConfiguration,
  listDoctors,
  listUsers,
  updateClinicConfiguration,
  updateUserAccount,
  type CreateUserPayload,
  type Doctor,
  type UpdateClinicConfigurationPayload,
  type UpdateUserPayload,
  type UserAccount,
} from '../api/client';
import { useAuth } from './AuthProvider';

interface SettingsContextType {
  appName: string;
  logo: string | null;
  users: UserAccount[];
  doctors: Doctor[];
  updateSettings: (data: UpdateClinicConfigurationPayload) => Promise<void>;
  addUser: (user: CreateUserPayload) => Promise<UserAccount>;
  updateUser: (id: string, data: UpdateUserPayload) => Promise<UserAccount>;
  addDoctor: (doctor: { name: string; department: string }) => Promise<Doctor>;
  widgetEnabled: boolean;
  setWidgetEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appName, setAppName] = useState<string>('EMR System');
  const [logo, setLogo] = useState<string | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [widgetEnabled, setWidgetEnabledState] = useState<boolean>(false);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) {
      setAppName('EMR System');
      setLogo(null);
      setWidgetEnabledState(false);
      return;
    }

    let active = true;
    getClinicConfiguration()
      .then((configuration) => {
        if (!active) return;
        setAppName(configuration.appName || 'EMR System');
        setLogo(configuration.logo ?? null);
        setWidgetEnabledState(Boolean(configuration.widgetEnabled));
      })
      .catch(() => {
        if (!active) return;
        setAppName('EMR System');
        setLogo(null);
        setWidgetEnabledState(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setDoctors([]);
      return;
    }

    let active = true;
    listDoctors()
      .then((data) => {
        if (!active) return;
        setDoctors(data);
      })
      .catch(() => {
        if (!active) return;
        setDoctors([]);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
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
  }, [accessToken]);

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

    if (Object.keys(payload).length === 0) {
      return;
    }

    const updated = await updateClinicConfiguration(payload);
    setAppName(updated.appName || 'EMR System');
    setLogo(updated.logo ?? null);
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

  const addDoctor = async (doctor: { name: string; department: string }) => {
    const created = await createDoctor(doctor);
    setDoctors((prev) => [...prev, created]);
    return created;
  };

  const setWidgetEnabled = (enabled: boolean) => {
    setWidgetEnabledState(enabled);
  };

  return (
    <SettingsContext.Provider
      value={{
        appName,
        logo,
        users,
        doctors,
        updateSettings,
        addUser,
        updateUser,
        addDoctor,
        widgetEnabled,
        setWidgetEnabled,
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

