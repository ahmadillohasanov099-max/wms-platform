import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Modal from '../../components/ui/modal';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { organizationsApi } from '../../api';
import type { Organization } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

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
  const { t } = useTranslation();
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
      toast.error(t('organizations.validationName'));
      return;
    }

    if (!organization) {
      if (!adminUsername.trim()) {
        toast.error(t('organizations.validationUsername'));
        return;
      }
      if (!adminPassword.trim() || adminPassword.length < 6) {
        toast.error(t('organizations.validationPassword'));
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
        toast.success(t('organizations.updateSuccess'));
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
        toast.success(t('organizations.createSuccess'));
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || t('organizations.operationError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={organization ? t('organizations.editTitle') : t('organizations.createTitle')}
      subtitle={t('organizations.modalSubtitle')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Boshqarma ma'lumotlari */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('organizations.nameRequired')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('organizations.namePlaceholder')}
            required
            className="sm:col-span-2"
          />

          <Input
            label={t('organizations.code')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('organizations.codePlaceholder')}
          />

          <Input
            label={t('organizations.phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('organizations.phonePlaceholder')}
          />

          <Input
            label={t('organizations.address')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('organizations.addressPlaceholder')}
            className="sm:col-span-2"
          />
        </div>

        {/* Section 2: Boshqarma Administratori (faqat yangi yaratilganda) */}
        {!organization && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>👤 {t('organizations.adminTitle')}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={t('organizations.adminFullName')}
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                placeholder={t('organizations.adminFullNamePlaceholder')}
                className="sm:col-span-2"
              />

              <Input
                label={t('organizations.adminUsername')}
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder={t('organizations.adminUsernamePlaceholder')}
                required
              />

              <Input
                label={t('organizations.adminPassword')}
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder={t('organizations.adminPasswordPlaceholder')}
                required
              />

              <Input
                label={t('organizations.adminPhone')}
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder={t('organizations.adminPhonePlaceholder')}
                className="sm:col-span-2"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {organization ? t('organizations.submitSave') : t('organizations.submitCreate')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
