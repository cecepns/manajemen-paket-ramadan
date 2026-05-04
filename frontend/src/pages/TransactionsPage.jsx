import { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import Select from 'react-select'
import Compressor from 'compressorjs'
import { Plus, Image as ImageIcon } from 'lucide-react'
import api from '../lib/api'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'https://www.api-paket-ramadan.isavralabel.com'

const toProofUrl = (path) => {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (normalizedPath.startsWith('/uploads/')) {
    return `${API_ORIGIN}/api${normalizedPath}`
  }
  return `${API_ORIGIN}${normalizedPath}`
}

const initForm = {
  id: null,
  reseller_id: '',
  deposit_date: '',
  amount: '',
  payment_method: 'cash',
  proof: null,
}

export default function TransactionsPage() {
  const isReseller = localStorage.getItem('auth_role') === 'reseller'
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total_pages: 1 })
  const [yearDate, setYearDate] = useState(new Date())
  const [resellers, setResellers] = useState([])
  const [filterResellerId, setFilterResellerId] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(initForm)

  useEffect(() => {
    if (isReseller) return
    api.get('/resellers?page=1&limit=100').then((r) => setResellers(r.data.data || []))
  }, [isReseller])

  const resellerOptions = useMemo(
    () => resellers.map((x) => ({ value: String(x.id), label: x.name })),
    [resellers],
  )

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      year: String(yearDate.getFullYear()),
    })
    if (!isReseller && filterResellerId) params.set('reseller_id', filterResellerId)
    return api.get(`/transactions?${params.toString()}`).then((r) => {
      setRows(r.data.data || [])
      setMeta(r.data.meta || { total_pages: 1 })
    })
  }, [page, yearDate, filterResellerId, isReseller])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [yearDate, filterResellerId])

  const onProofFile = (file) =>
    new Compressor(file, {
      quality: 0.85,
      maxWidth: 1600,
      success(result) {
        if (result.size > 900 * 1024) return toast.error('Maksimal ~900kb')
        setForm((s) => ({ ...s, proof: result }))
      },
      error() {
        toast.error('Gagal memproses gambar')
      },
    })

  const submit = async (e) => {
    e.preventDefault()
    if (!isReseller && !form.reseller_id) {
      toast.error('Pilih reseller')
      return
    }
    const fd = new FormData()
    if (form.id) fd.append('id', String(form.id))
    fd.append('deposit_date', form.deposit_date)
    fd.append('amount', String(form.amount))
    fd.append('payment_method', form.payment_method)
    if (!isReseller && form.reseller_id) fd.append('reseller_id', form.reseller_id)
    if (form.proof instanceof Blob) fd.append('proof', form.proof, 'proof.jpg')
    await api.post('/transaction_save', fd)
    toast.success(form.id ? 'Transaksi diperbarui' : 'Setoran tercatat')
    setForm(initForm)
    setOpen(false)
    load()
  }

  const openCreate = () => {
    setForm({
      ...initForm,
      deposit_date: new Date().toISOString().slice(0, 10),
      reseller_id: isReseller ? '' : '',
    })
    setOpen(true)
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Setoran ke Owner</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Tahun</p>
            <DatePicker
              selected={yearDate}
              onChange={(v) => setYearDate(v)}
              showYearPicker
              dateFormat="yyyy"
              className="rounded border border-slate-300 p-2 text-sm"
            />
          </div>
          {!isReseller && (
            <div className="w-56">
              <p className="mb-1 text-xs font-medium text-slate-600">Filter reseller</p>
              <Select
                isClearable
                placeholder="Semua"
                options={resellerOptions}
                value={resellerOptions.find((o) => o.value === filterResellerId) || null}
                onChange={(s) => setFilterResellerId(s?.value || '')}
              />
            </div>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Catat setoran
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Tanggal</th>
              {!isReseller && <th className="px-3 py-3">Reseller</th>}
              <th className="px-3 py-3 text-right">Jumlah</th>
              <th className="px-3 py-3">Metode</th>
              <th className="px-3 py-3">Bukti</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className="px-3 py-3 whitespace-nowrap">{r.deposit_date}</td>
                {!isReseller && <td className="px-3 py-3">{r.reseller_name || '—'}</td>}
                <td className="px-3 py-3 text-right font-semibold">Rp {Number(r.amount).toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 capitalize">{r.payment_method === 'transfer' ? 'Transfer' : 'Cash'}</td>
                <td className="px-3 py-3">
                  {r.proof_image_path ? (
                    <a
                      href={toProofUrl(r.proof_image_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-600 hover:underline"
                    >
                      <ImageIcon size={16} /> Lihat
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isReseller ? 4 : 5} className="px-3 py-10 text-center text-slate-500">
                  Belum ada setoran.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={meta.total_pages || 1} onChange={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title="Catat setoran ke owner">
        <form onSubmit={submit}>
          {!isReseller && (
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Reseller</label>
              <Select
                isRequired
                placeholder="Pilih reseller"
                options={resellerOptions}
                value={resellerOptions.find((o) => o.value === String(form.reseller_id)) || null}
                onChange={(s) => setForm({ ...form, reseller_id: s?.value || '' })}
              />
            </div>
          )}
          <label className="mb-1 block text-sm font-medium text-slate-700">Hari / tanggal setoran</label>
          <input
            type="date"
            className="mb-3 w-full rounded-lg border border-slate-300 p-2"
            value={form.deposit_date}
            onChange={(e) => setForm({ ...form, deposit_date: e.target.value })}
            required
          />
          <label className="mb-1 block text-sm font-medium text-slate-700">Jumlah setoran (Rp)</label>
          <input
            type="number"
            min="0"
            step="1000"
            className="mb-3 w-full rounded-lg border border-slate-300 p-2"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <label className="mb-1 block text-sm font-medium text-slate-700">Pembayaran</label>
          <select
            className="mb-3 w-full rounded-lg border border-slate-300 p-2"
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
          >
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
          </select>
          <label className="mb-1 block text-sm font-medium text-slate-700">Upload bukti setoran</label>
          <input
            type="file"
            accept="image/*"
            className="mb-4 w-full rounded-lg border border-slate-300 p-2"
            onChange={(e) => e.target.files?.[0] && onProofFile(e.target.files[0])}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2">
              Batal
            </button>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
