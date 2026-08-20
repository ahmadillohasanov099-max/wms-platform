import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '../../api';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Select from '../../components/ui/select';
import Button from '../../components/ui/button';
import { useTranslation } from '../../hooks/useTranslation';
import { invalidateAppQueries } from '../../lib/utils';
import type { ProductType, UnitType } from '../../types';

interface BulkItem {
  name: string;
  productType: ProductType;
  unit: UnitType;
  quantity: number;
  unitPrice: number;
  year?: number;
  description?: string;
  note?: string;
  inventoryNumbersText?: string;
  serialNumbersText?: string;
  documentNumber?: string;
}

const emptyItem = (): BulkItem => ({
  name: '',
  productType: 'BERILADIGAN',
  unit: 'DONA',
  quantity: 1,
  unitPrice: 0,
  documentNumber: '',
  year: undefined,
  description: '',
  note: '',
  inventoryNumbersText: '',
  serialNumbersText: '',
});

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BulkStockInPage({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BulkItem[]>([emptyItem()]);

  const update = (index: number, field: keyof BulkItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);

  const removeRow = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const validateItems = (): boolean => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name.trim()) {
        toast.error(`${t('inventory.validationName')} (#${i + 1})`);
        return false;
      }
      if (Number(item.quantity) < 1) {
        toast.error(`${t('inventory.validationQty')} (#${i + 1})`);
        return false;
      }
      if (item.productType === 'BERILADIGAN') {
        const qty = Number(item.quantity);
        const invs = (item.inventoryNumbersText || '')
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (invs.length !== qty) {
          toast.error(
            `${t('inventory.validationInvQtyMismatch', {
              entered: invs.length,
              expected: qty,
            })} (#${i + 1})`
          );
          return false;
        }
      }
    }
    return true;
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (!validateItems()) {
        throw new Error('Validation failed');
      }
      return inventoryApi.bulkStockIn({
        items: items.map((item) => {
          const invs = item.productType === 'BERILADIGAN'
            ? (item.inventoryNumbersText || '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
            : undefined;
          const sns = item.productType === 'BERILADIGAN'
            ? (item.serialNumbersText || '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
            : undefined;

          return {
            name: item.name,
            productType: item.productType,
            unit: item.unit,
            year: item.year ? Number(item.year) : undefined,
            description: item.description || undefined,
            note: item.note || undefined,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            documentNumber: item.documentNumber || undefined,
            inventoryNumbers: invs,
            serialNumbers: sns,
          };
        }),
      });
    },
    onSuccess: () => {
      toast.success(t('operations.bulkStockInSuccess', { count: items.length }));
      invalidateAppQueries(queryClient);
      setItems([emptyItem()]);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('common.error'));
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => { setItems([emptyItem()]); onClose(); }}
      title={t('operations.bulkStockIn')}
      subtitle={t('operations.bulkStockInDesc')}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => { setItems([emptyItem()]); onClose(); }} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mutate()} loading={isPending}>
            {t('operations.bulkStockInBtn', { count: items.length })}
          </Button>
        </>
      }
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {items.map((item, index) => {
          const parsedInvs = (item.inventoryNumbersText || '')
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const parsedSns = (item.serialNumbersText || '')
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);

          return (
            <div
              key={index}
              className="p-4 border border-gray-200 dark:border-gray-800 rounded-xl space-y-4 bg-white dark:bg-gray-900/50 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  #{index + 1}
                </span>
                {items.length > 1 && (
                  <button
                    onClick={() => removeRow(index)}
                    className="text-red-500 hover:text-red-600 transition-colors p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label={t('inventory.productName')}
                  placeholder="Lenovo ThinkPad E15"
                  value={item.name}
                  onChange={(e) => update(index, 'name', e.target.value)}
                  required
                />
                <Input
                  label={t('inventory.year')}
                  type="number"
                  placeholder="2024"
                  value={item.year ?? ''}
                  onChange={(e) => update(index, 'year', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label={t('products.type')}
                  options={[
                    { value: 'BERILADIGAN', label: t('inventory.typeAsset') },
                    { value: 'SARFLANADIGAN', label: t('inventory.typeConsumable') },
                  ]}
                  value={item.productType}
                  onChange={(e) => update(index, 'productType', e.target.value)}
                />
                <Select
                  label={t('operations.unit')}
                  options={[
                    { value: 'DONA', label: t('common.units.DONA') },
                    { value: 'PACHKA', label: t('common.units.PACHKA') },
                    { value: 'KOMPLEKT', label: t('common.units.KOMPLEKT') },
                  ]}
                  value={item.unit}
                  onChange={(e) => update(index, 'unit', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label={t('operations.quantity')}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => update(index, 'quantity', e.target.value)}
                  required
                />
                <Input
                  label={t('operations.price')}
                  type="number"
                  min={0}
                  value={item.unitPrice}
                  onChange={(e) => update(index, 'unitPrice', e.target.value)}
                  required
                />
                <Input
                  label={t('common.documentNumber')}
                  placeholder="AKT-2024-001"
                  value={item.documentNumber || ''}
                  onChange={(e) => update(index, 'documentNumber', e.target.value)}
                />
              </div>

              {item.productType === 'BERILADIGAN' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-150 dark:border-gray-800">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('inventory.inventoryNumbers')} <span className="text-red-500">*</span>
                      </label>
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${parsedInvs.length === Number(item.quantity) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {parsedInvs.length} / {item.quantity}
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      placeholder={t('inventory.inventoryNumbersPlaceholder')}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-1.5 resize-none"
                      value={item.inventoryNumbersText || ''}
                      onChange={(e) => update(index, 'inventoryNumbersText', e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('inventory.serialNumbers')}
                      </label>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {parsedSns.length} / {item.quantity}
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      placeholder={t('inventory.serialNumbersPlaceholder')}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-1.5 resize-none"
                      value={item.serialNumbersText || ''}
                      onChange={(e) => update(index, 'serialNumbersText', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <Button
          variant="outline"
          icon={<Plus className="w-4 h-4" />}
          onClick={addRow}
          className="w-full border-dashed py-3 border-gray-300 dark:border-gray-700 hover:border-primary-500 hover:text-primary-500 transition-all rounded-xl"
        >
          {t('operations.addRow')}
        </Button>
      </div>
    </Modal>
  );
}