import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import api from '../lib/api'
import Modal from '../components/Modal'

const init = { id: null, name: '' }

export default function PackageCategoriesPage() {
  const [list, setList] = useState([])
  const [form, setForm] = useState(init)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    return api.get('/package_categories').then((r) => setList(r.data.data || []))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    await api.post('/package_categories_save', form)
    toast.success(form.id ? 'Kategori diperbarui' : 'Kategori ditambah')
    setForm(init)
    setOpen(false)
    load()
  }

  const remove = (id) => {
    toast((t) => (
      <div className="flex items-center gap-2">
        <span>Hapus kategori ini? Produk terkait akan kehilangan kategori.</span>
        <button
          className="rounded bg-rose-600 px-2 py-1 text-white"
          onClick={async () => {
            await api.post('/package_categories_delete', { id })
            toast.dismiss(t.id)
            toast.success('Terhapus')
            load()
          }}
        >
          Ya
        </button>
      </div>
    ))
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Kategori Paket</h2>
        <button
          onClick={() => {
            setForm(init)
            setOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} /> Tambah Kategori
        </button>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        {list.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <p className="font-medium text-slate-800">{c.name}</p>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg bg-amber-500 p-2 text-white" onClick={() => { setForm({ id: c.id, name: c.name }); setOpen(true) }}>
                <Pencil size={16} />
              </button>
              <button type="button" className="rounded-lg bg-rose-600 p-2 text-white" onClick={() => remove(c.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-slate-500">Belum ada kategori.</p>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'Edit Kategori' : 'Kategori Baru'}>
        <form onSubmit={submit}>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nama kategori</label>
          <input
            className="mb-4 w-full rounded-lg border border-slate-300 p-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
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
