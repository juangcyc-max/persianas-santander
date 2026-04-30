import { useState } from 'react'
import { supabase } from '../../../services/supabase/client'
import { REQUIRED_EMPRESA } from '../constants'
import SectionHeader from '../components/SectionHeader'
import Spinner from '../components/Spinner'

export default function EmpresaTab({ empresa, setEmpresa, user, logoUrl, setLogoUrl }) {
  const [edit,    setEdit]    = useState(empresa ?? {})
  const [errors,  setErrors]  = useState({})
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [uploading, setUploading] = useState(false)

  const FIELDS = [
    { key: 'razon_social',       label: 'Razón social *' },
    { key: 'cif_nif',            label: 'CIF / NIF *' },
    { key: 'telefono',           label: 'Teléfono *' },
    { key: 'email_facturacion',  label: 'Email de facturación *' },
    { key: 'direccion_fiscal',   label: 'Dirección fiscal *' },
    { key: 'codigo_postal',      label: 'Código postal *' },
    { key: 'ciudad',             label: 'Ciudad *' },
    { key: 'provincia',          label: 'Provincia *' },
    { key: 'web',                label: 'Página web' },
  ]

  async function handleSave() {
    const errs = {}
    REQUIRED_EMPRESA.forEach(f => { if (!edit[f]?.toString().trim()) errs[f] = 'Obligatorio' })
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    const { error } = await supabase.from('professional_data').upsert({ ...edit, user_id: user.id })
    setSaving(false)
    if (!error) { setEmpresa(edit); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  async function handleLogo(file) {
    if (!file) return
    setUploading(true)
    const { error } = await supabase.storage.from('professional-logos').upload(`${user.id}/logo`, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('professional-logos').getPublicUrl(`${user.id}/logo`)
      setLogoUrl(data.publicUrl + `?t=${Date.now()}`)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Mi empresa" />

      {/* Logo */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">Logo de empresa</p>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center bg-gray-50">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} />
              : <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            }
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">PNG o JPG recomendado. Aparecerá en presupuestos y facturas.</p>
            <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors ${uploading ? 'opacity-60' : ''}`}>
              {uploading ? <><Spinner small /> Subiendo…</> : 'Cambiar logo'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => handleLogo(e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>

      {/* Campos */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">Datos fiscales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
              <input type="text" value={edit[key] ?? ''} onChange={e => { setEdit(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: '' })) }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors ${errors[key] ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white disabled:opacity-60'}`}>
            {saving ? <Spinner small /> : saved ? '✓ Guardado' : 'Guardar datos'}
          </button>
        </div>
      </div>
    </div>
  )
}
