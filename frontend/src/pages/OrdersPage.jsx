import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, PackagePlus, Pencil, Trash2, Eye, XCircle } from 'lucide-react'
import Select from 'react-select'
import api from '../lib/api'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'
import SearchInput from '../components/SearchInput'
import useDebounce from '../hooks/useDebounce'

const PAYMENT_PERIODS = [
  { value: '295_hari', label: '295 Hari' },
  { value: '325_hari', label: '325 Hari' },
  { value: '42_minggu', label: '42 Minggu' },
  { value: '45_minggu', label: '45 Minggu' },
]

function periodLabel(code) {
  if (code === 'legacy') return 'Historis (harga×qty)'
  return PAYMENT_PERIODS.find((p) => p.value === code)?.label || code || '—'
}

const initForm = {
  id: null,
  customer_name: '',
  customer_phone: '',
  customer_address: '',
  reseller_id: '',
  payment_status: 'belum_lunas',
  payment_period: '42_minggu',
  payment_days_total: 0,
  amount_paid: 0,
  items: [{ product_id: '', product_name: '', qty: 1 }],
}

const toNumberOrEmpty = (value) => (value === '' ? '' : Number(value))

export default function OrdersPage() {
  const isReseller = localStorage.getItem('auth_role') === 'reseller'
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [resellers, setResellers] = useState([])
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total_pages: 1 })
  const [form, setForm] = useState(initForm)
  const [openForm, setOpenForm] = useState(false)
  const [openDetail, setOpenDetail] = useState(false)
  const [detailOrder, setDetailOrder] = useState(null)
  const [mode, setMode] = useState('create')
  const [customerNameSearch, setCustomerNameSearch] = useState('')
  const [filterResellerId, setFilterResellerId] = useState('')
  const debouncedCustomerName = useDebounce(customerNameSearch, 500)
  const debouncedProductSearch = useDebounce(productSearch, 500)

  const load = useCallback(() => {
    const query = new URLSearchParams({
      page: String(page),
      limit: '10',
    })
    if (debouncedCustomerName.trim()) query.set('customer_name', debouncedCustomerName.trim())
    if (!isReseller && filterResellerId) query.set('reseller_id', filterResellerId)
    return api.get(`/orders?${query.toString()}`).then((r) => {
      setOrders(r.data.data)
      setMeta(r.data.meta)
    })
  }, [page, debouncedCustomerName, filterResellerId, isReseller])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedCustomerName, filterResellerId])
  useEffect(() => {
    if (isReseller) return
    api.get('/resellers?page=1&limit=100').then((r) => setResellers(r.data.data))
  }, [isReseller])
  useEffect(() => {
    const query = new URLSearchParams({
      page: '1',
      limit: '100',
      q: debouncedProductSearch,
    }).toString()
    api.get(`/products?${query}`).then((r) => setProducts(r.data.data || []))
  }, [debouncedProductSearch])

  const save = async (e) => {
    e.preventDefault()
    const filledItems = form.items.filter((item) => item.product_id)
    if (!filledItems.length) {
      toast.error('Pilih minimal satu produk')
      return
    }
    const payload = {
      ...form,
      payment_days_total: Number(form.payment_days_total || 0),
      amount_paid: Number(form.amount_paid || 0),
      payment_period: form.payment_period,
      items: filledItems.map((item) => ({
        product_id: item.product_id,
        qty: Math.max(1, Number(item.qty || 1)),
      })),
    }
    await api.post('/orders_save', payload)
    toast.success(mode === 'edit' ? 'Order diupdate' : 'Order tersimpan')
    setForm(initForm)
    setOpenForm(false)
    setMode('create')
    load()
  }
  const openAdd = () => {
    setForm(initForm)
    setMode('create')
    setOpenForm(true)
  }
  const openEdit = async (id) => {
    const { data } = await api.get(`/orders_detail?id=${id}`)
    const d = data.data
    setForm({
      id: d.id,
      customer_name: d.customer_name || '',
      customer_phone: d.customer_phone || '',
      customer_address: d.customer_address || '',
      reseller_id: d.reseller_id ? String(d.reseller_id) : '',
      payment_status: d.payment_status || 'belum_lunas',
      payment_period: d.payment_period ?? '42_minggu',
      payment_days_total: Number(d.payment_days_total || 0),
      amount_paid: Number(d.amount_paid || 0),
      items: (d.items || []).map((it) => ({ product_id: String(it.product_id), product_name: it.product_name || '', qty: Number(it.qty) })),
    })
    setMode('edit')
    setOpenForm(true)
  }
  const openView = async (id) => {
    const { data } = await api.get(`/orders_detail?id=${id}`)
    setDetailOrder(data.data)
    setOpenDetail(true)
  }
  const remove = (id) => {
    toast((t) => (
      <div className="flex items-center gap-2">
        <span>Hapus order ini?</span>
        <button
          className="rounded bg-rose-600 px-2 py-1 text-white"
          onClick={async () => {
            await api.post('/orders_delete', { id })
            toast.dismiss(t.id)
            toast.success('Order dihapus')
            load()
          }}
        >
          Ya
        </button>
      </div>
    ))
  }
  const resellerOptions = resellers.map((r) => ({ value: String(r.id), label: r.name }))
  const productOptions = products.map((p) => ({ value: String(p.id), label: p.name }))

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">{isReseller ? 'Order Pelanggan Saya' : 'Manajemen Order'}</h2>
        {!isReseller && (
          <div className="w-64">
            <Select
              isClearable
              isSearchable
              placeholder="Filter reseller..."
              options={resellerOptions}
              value={resellerOptions.find((opt) => opt.value === String(filterResellerId)) || null}
              onChange={(selected) => setFilterResellerId(selected?.value || '')}
            />
          </div>
        )}
        <div className="w-full min-w-[200px] max-w-sm">
          <p className="mb-1 text-xs font-medium text-slate-600">Cari nama pelanggan</p>
          <SearchInput value={customerNameSearch} onChange={setCustomerNameSearch} placeholder="Ketik nama pelanggan..." />
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus size={16} /> Input Order
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Daftar Order</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[1280px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">No</th>
                <th className="px-3 py-3 min-w-[160px]">Pelanggan</th>
                {!isReseller && <th className="px-3 py-3">Reseller</th>}
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Periode</th>
                <th className="px-3 py-3 text-right">Total order</th>
                <th className="px-3 py-3 text-right">Sudah dibayar</th>
                <th className="px-3 py-3 text-right">Sisa bayar</th>
                <th className="px-3 py-3 text-center">Target hari</th>
                <th className="px-3 py-3 text-center">Hari terpakai</th>
                <th className="px-3 py-3 text-center">Sisa hari</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, idx) => (
                <tr key={o.id} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-3 font-semibold text-slate-500">{(page - 1) * 10 + idx + 1}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-800">{o.customer_name}</p>
                    <p className="text-xs text-slate-500">{o.customer_phone || '-'}</p>
                  </td>
                  {!isReseller && <td className="px-3 py-3 text-slate-600">{o.reseller_name || '-'}</td>}
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{o.order_date}</td>
                  <td className="px-3 py-3 text-slate-600 text-sm whitespace-nowrap">{periodLabel(o.payment_period)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-800">Rp {Number(o.total_amount).toLocaleString('id-ID')}</td>
                  <td className="px-3 py-3 text-right text-emerald-700">
                    {o.payment_status === 'belum_lunas'
                      ? `Rp ${Number(o.amount_paid || 0).toLocaleString('id-ID')}`
                      : <span className="text-slate-500">Rp {Number(o.amount_paid || 0).toLocaleString('id-ID')}</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-amber-700">
                    {o.payment_status === 'belum_lunas'
                      ? `Rp ${Number(o.remaining_amount || 0).toLocaleString('id-ID')}`
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-700">
                    {o.payment_status === 'belum_lunas' ? Number(o.payment_days_target || 0) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-700">
                    {o.payment_status === 'belum_lunas' ? Number(o.payment_days_total || 0) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center font-semibold text-amber-800">
                    {o.payment_status === 'belum_lunas' ? Number(o.payment_days_remaining ?? 0) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${o.payment_status === 'lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {o.payment_status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="rounded-lg bg-sky-600 p-2 text-white" onClick={() => openView(o.id)}><Eye size={16} /></button>
                      <button type="button" className="rounded-lg bg-amber-500 p-2 text-white" onClick={() => openEdit(o.id)}><Pencil size={16} /></button>
                      {!isReseller && (
                        <button type="button" className="rounded-lg bg-rose-600 p-2 text-white" onClick={() => remove(o.id)}><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={isReseller ? 12 : 13} className="px-3 py-8 text-center text-slate-500">Data order tidak ditemukan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={meta.total_pages || 1} onChange={setPage} />
      </div>

      <Modal open={openForm} onClose={() => setOpenForm(false)} title={mode === 'edit' ? 'Edit Order' : 'Input Order Baru'}>
        <form onSubmit={save}>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nama Pelanggan</label>
          <input className="mb-2 w-full rounded-lg border border-slate-300 p-2" placeholder="Nama Pelanggan" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          <label className="mb-1 block text-sm font-medium text-slate-700">No HP Pelanggan</label>
          <input className="mb-2 w-full rounded-lg border border-slate-300 p-2" placeholder="No HP Pelanggan" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
          <label className="mb-1 block text-sm font-medium text-slate-700">Alamat</label>
          <textarea className="mb-2 w-full rounded-lg border border-slate-300 p-2" placeholder="Alamat lengkap anggota" rows={2} value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
          {!isReseller && (
            <div className="mb-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Reseller</label>
              <Select
                isClearable
                isSearchable
                placeholder="Pilih reseller (opsional)"
                options={resellerOptions}
                value={resellerOptions.find((opt) => opt.value === String(form.reseller_id)) || null}
                onChange={(selected) => setForm({ ...form, reseller_id: selected?.value || '' })}
                classNamePrefix="react-select"
              />
              <p className="mt-1 text-xs text-slate-500">Kosongkan untuk pelanggan langsung (tanpa reseller)</p>
            </div>
          )}
          <label className="mb-1 block text-sm font-medium text-slate-700">Status Pembayaran</label>
          <select className="mb-2 w-full rounded-lg border border-slate-300 p-2" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
            <option value="belum_lunas">Belum Lunas</option>
            <option value="lunas">Lunas</option>
          </select>
          <label className="mb-1 block text-sm font-medium text-slate-700">Periode pembayaran</label>
          <select
            className="mb-1 w-full rounded-lg border border-slate-300 p-2"
            value={form.payment_period}
            onChange={(e) => setForm({ ...form, payment_period: e.target.value })}
          >
            {mode === 'edit' && form.payment_period === 'legacy' ? (
              <option value="legacy">{periodLabel('legacy')} — ubah jika ingin pakai periode baru</option>
            ) : null}
            {PAYMENT_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mb-3 text-xs text-slate-500">
            Menentukan pengali total order (harga × qty × periode). Contoh: paket mingguan Rp 15.000, qty 1, periode 42 Minggu → total Rp 630.000.
          </p>
          {form.payment_status === 'belum_lunas' && (
            <>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hari terpakai (cicilan)</label>
              <input
                type="number"
                min="0"
                className="mb-2 w-full rounded-lg border border-slate-300 p-2"
                placeholder="Hari terpakai saat ini"
                value={form.payment_days_total}
                onChange={(e) => setForm({ ...form, payment_days_total: toNumberOrEmpty(e.target.value) })}
              />
              <label className="mb-1 block text-sm font-medium text-slate-700">Total Uang Yang Dibayarkan</label>
              <input
                type="number"
                min="0"
                className="mb-2 w-full rounded-lg border border-slate-300 p-2"
                placeholder="Total Uang Yang Dibayarkan"
                value={form.amount_paid}
                onChange={(e) => setForm({ ...form, amount_paid: toNumberOrEmpty(e.target.value) })}
              />
            </>
          )}
          {form.items.map((it, idx) => (
            <div key={idx} className="mb-2 rounded-lg border border-slate-200 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">Produk #{idx + 1}</label>
                {form.items.length > 1 ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      const next = form.items.filter((_, i) => i !== idx)
                      setForm({ ...form, items: next.length ? next : [{ product_id: '', product_name: '', qty: 1 }] })
                    }}
                  >
                    <XCircle size={14} /> Hapus baris
                  </button>
                ) : null}
              </div>
              <Select
                isClearable
                isSearchable
                placeholder="Pilih Produk"
                options={productOptions}
                value={productOptions.find((opt) => opt.value === String(it.product_id)) || (it.product_id ? { value: String(it.product_id), label: it.product_name || `Produk #${it.product_id}` } : null)}
                onInputChange={(inputValue, meta) => {
                  if (meta.action === 'input-change') {
                    setProductSearch(inputValue)
                  }
                }}
                onChange={(selected) => {
                  const next = [...form.items]
                  next[idx].product_id = selected?.value || ''
                  next[idx].product_name = selected?.label || ''
                  setForm({ ...form, items: next })
                }}
                classNamePrefix="react-select"
              />
              <label className="mb-1 block text-sm font-medium text-slate-700">Jumlah (Qty)</label>
              <input type="number" min="1" className="w-full rounded-lg border border-slate-300 p-2" value={it.qty} onChange={(e) => {
                const next = [...form.items]
                next[idx].qty = toNumberOrEmpty(e.target.value)
                setForm({ ...form, items: next })
              }} />
            </div>
          ))}
          <button
            type="button"
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={() => setForm({ ...form, items: [...form.items, { product_id: '', product_name: '', qty: 1 }] })}
          >
            <PackagePlus size={16} /> Tambah Produk
          </button>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpenForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Batal</button>
            <button className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white">{mode === 'edit' ? 'Update Order' : 'Simpan Order'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={openDetail} onClose={() => setOpenDetail(false)} title="Detail Order">
        {!detailOrder ? null : (
          <div>
            <p className="font-semibold">{detailOrder.customer_name} {detailOrder.reseller_name ? `- via ${detailOrder.reseller_name}` : ''}</p>
            <p className="text-sm text-slate-600">HP: {detailOrder.customer_phone || '-'}</p>
            {detailOrder.customer_address ? <p className="text-sm text-slate-600">Alamat: {detailOrder.customer_address}</p> : null}
            <p className="text-sm text-slate-500">Periode: {periodLabel(detailOrder.payment_period)}</p>
            <p className="text-sm text-slate-500">{detailOrder.order_date}</p>
            <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${detailOrder.payment_status === 'lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {detailOrder.payment_status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
            </span>
            {detailOrder.payment_status === 'belum_lunas' && (
              <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm">
                <p>Total Harga Barang: Rp {Number(detailOrder.total_amount).toLocaleString('id-ID')}</p>
                <p>Target hari cicilan (dari produk): {Number(detailOrder.payment_days_target || 0)} hari</p>
                <p>Hari terpakai: {detailOrder.payment_days_total || 0} hari</p>
                <p>Sisa hari: {Number(detailOrder.payment_days_remaining ?? 0)} hari</p>
                <p>Jumlah Baru Dibayarkan: Rp {Number(detailOrder.amount_paid || 0).toLocaleString('id-ID')}</p>
                <p className="font-semibold">Total Belum Dibayar: Rp {Number(detailOrder.remaining_amount || 0).toLocaleString('id-ID')}</p>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {detailOrder.items?.map((item, idx) => (
                <div key={item.id || idx} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold">{idx + 1}. {item.product_name}</p>
                  <p className="text-sm text-slate-500">Qty {item.qty} x Rp {Number(item.price).toLocaleString('id-ID')}{Number(item.product_payment_days_total) > 0 ? ` • ${Number(item.product_payment_days_total)} hari/pcs` : ''}</p>
                  <p className="text-sm font-semibold">Subtotal Rp {Number(item.subtotal).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-right text-base font-bold">Total Rp {Number(detailOrder.total_amount).toLocaleString('id-ID')}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
