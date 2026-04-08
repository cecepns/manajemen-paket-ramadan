import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import api from '../lib/api'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'
import SearchInput from '../components/SearchInput'
import useDebounce from '../hooks/useDebounce'

const init = { id: null, name: '', phone: '', address: '', login_username: '', password: '' }

export default function ResellersPage() {
  const [form, setForm] = useState(init)
  const [list, setList] = useState([])
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total_pages: 1 })
  const [open, setOpen] = useState(false)
  const [openDetail, setOpenDetail] = useState(false)
  const [detail, setDetail] = useState({ reseller: null, orders: [] })
  const [editingPayments, setEditingPayments] = useState({})
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 1000)

  const load = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: '10', q: debouncedSearch }).toString()
    return api.get(`/resellers.php?${query}`).then((r) => {
      setList(r.data.data)
      setMeta(r.data.meta)
    })
  }, [page, debouncedSearch])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const submit = async (e) => {
    e.preventDefault()
    await api.post('/resellers_save.php', form)
    toast.success(form.id ? 'Reseller diupdate' : 'Reseller ditambah')
    setForm(init)
    setOpen(false)
    load()
  }
  const openAdd = () => {
    setForm(init)
    setOpen(true)
  }
  const openEdit = (reseller) => {
    setForm({ ...init, ...reseller, password: '' })
    setOpen(true)
  }
  const remove = (id) => {
    toast((t) => (
      <div className="flex items-center gap-2">
        <span>Hapus reseller ini?</span>
        <button
          className="rounded bg-rose-600 px-2 py-1 text-white"
          onClick={async () => {
            await api.post('/resellers_delete.php', { id })
            toast.dismiss(t.id)
            toast.success('Reseller dihapus')
            load()
          }}
        >
          Ya
        </button>
      </div>
    ))
  }

  const openOrdersDetail = async (resellerId) => {
    const { data } = await api.get(`/reseller_orders.php?reseller_id=${resellerId}`)
    setDetail(data.data || { reseller: null, orders: [] })
    const initialEditingPayments = {}
    ;(data.data?.orders || []).forEach((order) => {
      initialEditingPayments[order.id] = {
        amount_paid: Number(order.amount_paid || 0),
        payment_days_total: Number(order.payment_days_total || 0),
      }
    })
    setEditingPayments(initialEditingPayments)
    setOpenDetail(true)
  }

  const updatePaymentField = (orderId, field, value) => {
    const parsedValue = value === '' ? '' : Number(value)
    setEditingPayments((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: parsedValue,
      },
    }))
  }

  const saveOrderPayment = async (orderId) => {
    const payload = editingPayments[orderId] || { amount_paid: 0, payment_days_total: 0 }
    await api.post('/reseller_order_payment_save.php', {
      order_id: orderId,
      amount_paid: Number(payload.amount_paid || 0),
      payment_days_total: Number(payload.payment_days_total || 0),
    })
    toast.success('Uang masuk order diperbarui')
    await Promise.all([load(), openOrdersDetail(detail.reseller?.id)])
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Manajemen Reseller</h2>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nama/telepon/alamat reseller..." />
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus size={16} /> Tambah Reseller
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Daftar Reseller</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">No</th>
                <th className="px-3 py-3">Reseller</th>
                <th className="px-3 py-3">Kontak</th>
                <th className="px-3 py-3">Total Order Nasabah</th>
                <th className="px-3 py-3">Nilai Order</th>
                <th className="px-3 py-3">Uang Masuk</th>
                <th className="px-3 py-3">Sisa Belum Dibayar</th>
                <th className="px-3 py-3">Status Balance</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, idx) => {
                const sisa = Number(r.total_sisa_bayar || 0)
                return (
                  <tr key={r.id} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold text-slate-500">{(page - 1) * 10 + idx + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.address || '-'}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{r.phone || '-'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{Number(r.total_orders || 0)}</td>
                    <td className="px-3 py-3 text-slate-700">Rp {Number(r.total_order_amount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-3 py-3 text-emerald-700 font-semibold">Rp {Number(r.total_uang_masuk || 0).toLocaleString('id-ID')}</td>
                    <td className={`px-3 py-3 font-semibold ${sisa > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                      Rp {sisa.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${sisa > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {sisa > 0 ? 'Belum Balance' : 'Balance'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <button className="rounded-lg bg-sky-600 p-2 text-white" onClick={() => openOrdersDetail(r.id)}><Eye size={16} /></button>
                        <button className="rounded-lg bg-amber-500 p-2 text-white" onClick={() => openEdit(r)}><Pencil size={16} /></button>
                        <button className="rounded-lg bg-rose-600 p-2 text-white" onClick={() => remove(r.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">Data reseller tidak ditemukan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={meta.total_pages || 1} onChange={setPage} />
      </div>

      <Modal open={open} title={form.id ? 'Edit Reseller' : 'Tambah Reseller'} onClose={() => setOpen(false)}>
        <form onSubmit={submit}>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nama Reseller</label>
          <input className="mb-2 w-full rounded-lg border border-slate-300 p-2" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="mb-1 block text-sm font-medium text-slate-700">Nomor Telepon</label>
          <input className="mb-2 w-full rounded-lg border border-slate-300 p-2" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <label className="mb-1 block text-sm font-medium text-slate-700">Alamat</label>
          <textarea className="mb-2 w-full rounded-lg border border-slate-300 p-2" placeholder="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <label className="mb-1 block text-sm font-medium text-slate-700">Username login reseller</label>
          <input className="mb-2 w-full rounded-lg border border-slate-300 p-2" placeholder="Username untuk login mandiri" value={form.login_username || ''} onChange={(e) => setForm({ ...form, login_username: e.target.value })} />
          <label className="mb-1 block text-sm font-medium text-slate-700">Password login</label>
          <input type="password" className="mb-2 w-full rounded-lg border border-slate-300 p-2" placeholder={form.id ? 'Kosongkan jika tidak diubah' : 'Password awal'} value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className="mb-4 text-xs text-slate-500">Reseller dengan username & password bisa login di tab &quot;Reseller&quot; pada halaman login.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Batal</button>
            <button className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white">Simpan</button>
          </div>
        </form>
      </Modal>

      <Modal open={openDetail} title={`Nasabah & Order ${detail.reseller?.name || ''}`} onClose={() => setOpenDetail(false)}>
        {detail.orders.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada order dari reseller ini.</p>
        ) : (
          <div className="space-y-3">
            {detail.orders.map((order) => {
              const paid = Number(editingPayments[order.id]?.amount_paid ?? order.amount_paid ?? 0)
              const total = Number(order.total_amount || 0)
              const remaining = Math.max(total - paid, 0)
              const isLunas = remaining <= 0
              return (
                <div key={order.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{order.customer_name}</p>
                      <p className="text-xs text-slate-500">{order.customer_phone || '-'} • {order.order_date}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${isLunas ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isLunas ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </div>
                  <div className="mb-2 grid gap-2 md:grid-cols-3">
                    <p className="text-sm text-slate-700">Total: <span className="font-semibold">Rp {total.toLocaleString('id-ID')}</span></p>
                    <p className="text-sm text-emerald-700">Dibayar: <span className="font-semibold">Rp {paid.toLocaleString('id-ID')}</span></p>
                    <p className={`text-sm ${remaining > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Sisa: <span className="font-semibold">Rp {remaining.toLocaleString('id-ID')}</span></p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Uang Masuk (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-lg border border-slate-300 p-2"
                        placeholder="Masukkan uang masuk"
                        value={editingPayments[order.id]?.amount_paid ?? 0}
                        onChange={(e) => updatePaymentField(order.id, 'amount_paid', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total Hari Bayar
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-lg border border-slate-300 p-2"
                        placeholder="Masukkan jumlah hari bayar"
                        value={editingPayments[order.id]?.payment_days_total ?? 0}
                        onChange={(e) => updatePaymentField(order.id, 'payment_days_total', e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="self-end rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                      onClick={() => saveOrderPayment(order.id)}
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
