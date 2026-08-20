import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Building2, Edit, Phone, MapPin, Eye } from 'lucide-react';
import { Card, Button, Badge, Spinner, PageHeader, SearchFilterCard } from '../../components/ui';
import OrganizationModal from './organization-modal';
import { organizationsApi } from '../../api';
import type { Organization } from '../../types';

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const { data: orgsData, isLoading, refetch } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationsApi.getAll(),
  });

  const rawList: Organization[] = Array.isArray(orgsData)
    ? orgsData
    : Array.isArray((orgsData as any)?.data)
    ? (orgsData as any).data
    : [];

  const subOrgsOnly = rawList.filter((org) => org.type !== 'MINISTRY');

  const filteredOrgs = subOrgsOnly.filter(
    (org) =>
      org.name?.toLowerCase().includes(search.toLowerCase()) ||
      org.code?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (org: Organization) => {
    setSelectedOrg(org);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedOrg(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hududiy Boshqarmalar"
        subtitle="Vazirlik tasarrufidagi viloyat boshqarmalari va quyi tashkilotlar ro'yxati"
        actions={
          <Button onClick={handleCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Yangi Boshqarma Qo‘shish
          </Button>
        }
      />

      <SearchFilterCard
        searchPlaceholder="Boshqarma nomi yoki kodi bo'yicha qidirish..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : filteredOrgs.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Hech qanday boshqarma topilmadi
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrgs.map((org) => (
            <Card key={org.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base line-clamp-2">
                      {org.name}
                    </h3>
                    {org.code && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono text-gray-600 dark:text-gray-400">
                        {org.code}
                      </span>
                    )}
                  </div>
                  <Badge variant={org.type === 'MINISTRY' ? 'info' : 'gray'}>
                    {org.type === 'MINISTRY' ? 'Vazirlik' : 'Viloyat Boshqarmasi'}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400 mt-4">
                  {org.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{org.address}</span>
                    </div>
                  )}
                  {org.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{org.phone}</span>
                    </div>
                  )}
                </div>

                {org._count && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                    <span>👥 {org._count.users || 0} xodim</span>
                    <span>🏢 {org._count.departments || 0} bo‘lim</span>
                    <span>📦 {org._count.products || 0} tovar</span>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/organizations/${org.id}`)}
                  className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 border-primary-200 hover:bg-primary-50 dark:hover:bg-primary-950/40"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Batafsil ko'rish
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(org)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Tahrirlash
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <OrganizationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        organization={selectedOrg}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
