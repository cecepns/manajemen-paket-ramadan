import { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import Select from 'react-select'
import { Download, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../lib/api'
import Pagination from '../components/Pagination'
import SearchInput from '../components/SearchInput'
import useDebounce from '../hooks/useDebounce'

const emptySummary = {
  order_count: 0,
  sum_total_amount: 0,
  sum_amount_paid: 0,
  sum_remaining_amount: 0,
  count_belum_lunas: 0,
  count_lunas: 0,
  sum_deposits: 0,
  selisih_pembayaran_anggota_vs_setoran: 0,
}

export default function ReportsPage() {
  const isReseller = localStorage.getItem('auth_role') === 'reseller'
  const [yearDate, setYearDate] = useState(new Date())
  const [rows, setRows] = useState([])
  const [resellers, setResellers] = useState([])
  const [resellerId, setResellerId] = useState('')
  const [customerQ, setCustomerQ] = useState('')
  const debouncedCustomerQ = useDebounce(customerQ, 500)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total_pages: 1, total: 0 })
  const [summary, setSummary] = useState(emptySummary)

  useEffect(() => {
    if (isReseller) return
    api.get('/resellers?page=1&limit=100').then((r) => setResellers(r.data.data))
  }, [isReseller])

  const resellerOptions = useMemo(
    () => resellers.map((r) => ({ value: String(r.id), label: r.name })),
    [resellers],
  )

  const getReport = useCallback(async (targetPage) => {
    const selectedYear = yearDate.getFullYear()
    const params = new URLSearchParams({
      year: String(selectedYear),
      page: String(targetPage),
      limit: '500',
      q: debouncedCustomerQ,
    })
    if (!isReseller && resellerId) params.set('reseller_id', resellerId)
    const { data } = await api.get(`/reports?${params.toString()}`)
    setRows(data.data || [])
    setMeta(data.meta || { total_pages: 1, total: 0 })
    setSummary({ ...emptySummary, ...(data.meta?.summary || {}) })
  }, [resellerId, yearDate, debouncedCustomerQ, isReseller])

  useEffect(() => {
    setPage(1)
  }, [debouncedCustomerQ, resellerId, yearDate, isReseller])

  useEffect(() => {
    getReport(page)
  }, [page, getReport])

  const fetchAllRows = async () => {
    const selectedYear = yearDate.getFullYear()
    let current = 1
    const all = []
    while (true) {
      const params = new URLSearchParams({
        year: String(selectedYear),
        page: String(current),
        limit: '500',
        q: debouncedCustomerQ,
      })
      if (!isReseller && resellerId) params.set('reseller_id', resellerId)
      const { data } = await api.get(`/reports?${params.toString()}`)
      all.push(...(data.data || []))
      const totalPages = Number(data.meta?.total_pages || 1)
      if (current >= totalPages) break
      current += 1
    }
    return all
  }

  const exportHeaders = [
    'No', 'Tanggal', 'Pelanggan', 'No HP', 'Reseller', 'Total order', 'Dibayar', 'Sisa bayar',
    'Target hari', 'Hari terpakai', 'Sisa hari', 'Status',
  ]

  const exportCsv = async () => {
    const allRows = await fetchAllRows()
    if (!allRows.length) return toast.error('Data laporan kosong')
    const body = allRows.map((r, idx) => [
      idx + 1,
      r.order_date,
      r.customer_name,
      r.customer_phone || '-',
      r.reseller_name || '-',
      Number(r.total_amount),
      Number(r.amount_paid || 0),
      r.payment_status === 'lunas' ? 0 : Number(r.remaining_amount || 0),
      Number(r.payment_days_target || 0),
      Number(r.payment_days_total || 0),
      Number(r.payment_days_remaining ?? 0),
      r.payment_status === 'lunas' ? 'Lunas' : 'Belum Lunas',
    ])
    const csvRows = [exportHeaders, ...body].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `laporan-order-${yearDate.getFullYear()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const exportPdf = async () => {
    const allRows = await fetchAllRows()
    if (!allRows.length) return toast.error('Data laporan kosong')
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Laporan Order Paket Ramadhan', 14, 14)
    doc.setFontSize(10)
    doc.text(`Tahun: ${yearDate.getFullYear()}`, 14, 20)
    autoTable(doc, {
      startY: 24,
      head: [exportHeaders],
      body: allRows.map((r, idx) => [
        idx + 1,
        r.order_date,
        r.customer_name,
        r.customer_phone || '-',
        r.reseller_name || '-',
        `Rp ${Number(r.total_amount).toLocaleString('id-ID')}`,
        `Rp ${Number(r.amount_paid || 0).toLocaleString('id-ID')}`,
        r.payment_status === 'lunas' ? '—' : `Rp ${Number(r.remaining_amount || 0).toLocaleString('id-ID')}`,
        String(r.payment_days_target ?? 0),
        String(r.payment_days_total ?? 0),
        String(r.payment_days_remaining ?? 0),
        r.payment_status === 'lunas' ? 'Lunas' : 'Belum Lunas',
      ]),
      styles: { fontSize: 7 },
      headStyles: { fontSize: 7 },
    })
    doc.save(`laporan-order-${yearDate.getFullYear()}.pdf`)
  }

  return (
    <div className="card">
      <h1 className="mb-4 text-xl font-bold">Laporan Order</h1>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-sm">Tahun</p>
          <DatePicker
            selected={yearDate}
            onChange={(value) => setYearDate(value)}
            showYearPicker
            dateFormat="yyyy"
            className="rounded border p-2"
          />
        </div>
        {!isReseller && (
          <div className="w-full max-w-xs">
            <p className="mb-1 text-sm">Reseller</p>
            <Select
              isClearable
              isSearchable
              placeholder="Semua reseller"
              options={resellerOptions}
              value={resellerOptions.find((opt) => opt.value === resellerId) || null}
              onChange={(selected) => setResellerId(selected?.value || '')}
            />
          </div>
        )}
        <div className="w-full min-w-[200px] max-w-sm">
          <p className="mb-1 text-sm font-medium text-slate-700">Cari nama pelanggan</p>
          <SearchInput value={customerQ} onChange={setCustomerQ} placeholder="Ketik nama pelanggan..." />
        </div>
        <button className="rounded bg-brand-600 px-4 py-2 text-white" onClick={() => { setPage(1); getReport(1) }} type="button">Filter</button>
        <button className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-white" type="button" onClick={exportCsv}><Download size={16} /> CSV</button>
        <button className="inline-flex items-center gap-2 rounded bg-rose-600 px-4 py-2 text-white" type="button" onClick={exportPdf}><FileText size={16} /> PDF</button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jumlah order</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{summary.order_count}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total nilai order</p>
          <p className="mt-1 text-lg font-bold text-slate-800">Rp {Number(summary.sum_total_amount).toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total sudah dibayar</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">Rp {Number(summary.sum_amount_paid).toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Total sisa bayar</p>
          <p className="mt-1 text-lg font-bold text-amber-900">Rp {Number(summary.sum_remaining_amount).toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Belum lunas</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{summary.count_belum_lunas}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lunas</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{summary.count_lunas}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Total setoran ke owner</p>
          <p className="mt-1 text-lg font-bold text-violet-900">Rp {Number(summary.sum_deposits || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">Selisih: pembayaran anggota − setoran</p>
          <p className="mt-1 text-lg font-bold text-sky-950">
            Rp {Number(summary.selisih_pembayaran_anggota_vs_setoran || 0).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r, idx) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  {(page - 1) * 500 + idx + 1}. {r.customer_name}
                </p>
                <p className="text-sm text-slate-500">HP: {r.customer_phone || '-'} • Tanggal order: {r.order_date}</p>
                {!isReseller && r.reseller_name && (
                  <p className="text-sm text-slate-600">Reseller: {r.reseller_name}</p>
                )}
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${r.payment_status === 'lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {r.payment_status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Total order</p>
                <p className="font-semibold text-slate-800">Rp {Number(r.total_amount).toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Sudah dibayar</p>
                <p className="font-semibold text-emerald-700">Rp {Number(r.amount_paid || 0).toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Sisa bayar</p>
                <p className="font-semibold text-amber-800">
                  {r.payment_status === 'belum_lunas' ? `Rp ${Number(r.remaining_amount || 0).toLocaleString('id-ID')}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Cicilan (hari)</p>
                {r.payment_status === 'belum_lunas' ? (
                  <p className="text-sm text-slate-700">
                    Target <span className="font-semibold">{Number(r.payment_days_target || 0)}</span>
                    {' · '}
                    Terpakai <span className="font-semibold">{Number(r.payment_days_total || 0)}</span>
                    {' · '}
                    Sisa <span className="font-semibold text-amber-800">{Number(r.payment_days_remaining ?? 0)}</span>
                  </p>
                ) : (
                  <p className="text-slate-400">—</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={meta.total_pages || 1}
        onChange={setPage}
      />
    </div>
  )
}
