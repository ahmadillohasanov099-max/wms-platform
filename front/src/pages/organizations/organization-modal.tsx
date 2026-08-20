import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Modal from '../../components/ui/modal';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { organizationsApi } from '../../api';
import type { Organization } from '../../types';

interface OrganizationModalProps {
  open: boolean;
  onClose: () => void;
  organization?: Organization | null;
  onSuccess: () => void;
}

export default function OrganizationModal({
  open,
  onClose,
  organization,
  onSuccess,
}: OrganizationModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Initial Administrator Details
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setCode(organization.code || '');
      setAddress(organization.address || '');
      setPhone(organization.phone || '');
      setAdminFullName('');
      setAdminUsername('');
      setAdminPassword('');
      setAdminPhone('');
    } else {
      setName('');
      setCode('');
      setAddress('');
      setPhone('');
      setAdminFullName('');
      setAdminUsername('');
      setAdminPassword('');
      setAdminPhone('');
    }
  }, [organization, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Iltimos, boshqarma nomini kiriting');
      return;
    }

    if (!organization) {
      if (!adminUsername.trim()) {
        toast.error('Iltimos, boshqarma administratori uchun login (username) kiriting');
        return;
      }
      if (!adminPassword.trim() || adminPassword.length < 6) {
        toast.error('Administrator paroli kamida 6 ta belgidan iborat bo‘lishi kerak');
        return;
      }
    }

    setLoading(true);
    try {
      if (organization) {
        await organizationsApi.update(organization.id, {
          name: name.trim(),
          code: code.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        toast.success('Boshqarma ma\'lumotlari tahrirlandi');
      } else {
        await organizationsApi.create({
          name: name.trim(),
          code: code.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          type: 'SUB_ORG',
          adminFullName: adminFullName.trim() || undefined,
          adminUsername: adminUsername.trim(),
          adminPassword: adminPassword.trim(),
          adminPhone: adminPhone.trim() || undefined,
        });
        toast.success('Yangi boshqarma va uning administratori muvaffaqiyatli yaratildi!');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Amalni bajarishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={organization ? 'Boshqarmani tahrirlash' : 'Yangi Boshqarma Qo‘shish'}
      subtitle="Vazirlik tasarrufidagi hududiy boshqarma va uning birinchi administratorini kiriting"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Boshqarma ma'lumotlari */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Boshqarma nomi *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Samarqand viloyati Qurilish Boshqarmasi"
            required
            className="sm:col-span-2"
          />

          <Input
            label="Boshqarma kodi"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SAMARKAND_REG"
          />

          <Input
            label="Boshqarma telefon raqami"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 66 123-45-67"
          />

          <Input
            label="Manzil"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Samarqand sh., Registon ko'chasi"
            className="sm:col-span-2"
          />
        </div>

        {/* Section 2: Boshqarma Administratori (faqat yangi yaratilganda) */}
        {!organization && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>👤 Boshqarma Administratori</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Admin To'liq ismi"
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                placeholder="Vali Aliyev"
                className="sm:col-span-2"
              />

              <Input
                label="Admin Username *"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="sam_admin"
                required
              />

              <Input
                label="Admin Paroli *"
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="admin123"
                required
              />

              <Input
                label="Admin Telefon Raqami"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="+998 90 123-45-67"
                className="sm:col-span-2"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {organization ? 'Saqlash' : 'Boshqarma va Adminni Yaratish'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
