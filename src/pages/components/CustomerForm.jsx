import { sendBudgetEmail } from '../../services/email'
import { generateBudgetPDF } from '../../services/pdf'

function CustomerForm({
  customerData = {},
  onCustomerDataChange,
  configuration = {},
  onSubmit,
  loading = false
}) {

  const handleChange = (field, value) => {
    onCustomerDataChange({
      ...customerData,
      [field]: value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!customerData.name || !customerData.phone || !customerData.email) {
      alert("⚠️ Por favor completa los campos obligatorios")
      return
    }

    try {

      const result = await sendBudgetEmail(customerData, configuration)

      if (result.success) {
        alert("✅ Presupuesto enviado correctamente. Nos pondremos en contacto contigo pronto.")
        onSubmit?.()
      } else {
        alert("❌ Error al enviar el presupuesto. Inténtalo de nuevo.")
      }

    } catch (error) {
      console.error("Error enviando email:", error)
      alert("❌ Error inesperado al enviar el presupuesto.")
    }
  }

  const handleDownloadPDF = () => {
    try {

      generateBudgetPDF(customerData, configuration)

      alert("📄 PDF descargado correctamente")

    } catch (error) {

      console.error("Error generando PDF:", error)

      alert("❌ Error al generar el PDF. Inténtalo de nuevo.")

    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <h2 className="text-xl font-semibold mb-4 text-santander-red">
        📋 Tus Datos
      </h2>

      {/* Nombre */}
      <div>
        <label className="block text-gray-700 mb-2 font-medium">
          Nombre completo *
        </label>

        <input
          type="text"
          value={customerData.name || ""}
          onChange={(e) => handleChange("name", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-santander-red focus:border-transparent"
          required
          placeholder="Ej: Juan García"
        />
      </div>

      {/* Teléfono */}
      <div>
        <label className="block text-gray-700 mb-2 font-medium">
          Teléfono *
        </label>

        <input
          type="tel"
          value={customerData.phone || ""}
          onChange={(e) => handleChange("phone", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-santander-red focus:border-transparent"
          required
          placeholder="Ej: 600123456"
          pattern="[0-9]{9}"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-gray-700 mb-2 font-medium">
          Email *
        </label>

        <input
          type="email"
          value={customerData.email || ""}
          onChange={(e) => handleChange("email", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-santander-red focus:border-transparent"
          required
          placeholder="ejemplo@email.com"
        />
      </div>

      {/* Dirección */}
      <div>
        <label className="block text-gray-700 mb-2 font-medium">
          Dirección
        </label>

        <input
          type="text"
          value={customerData.address || ""}
          onChange={(e) => handleChange("address", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-santander-red focus:border-transparent"
          placeholder="Ej: Calle Mayor 123, Madrid"
        />
      </div>

      {/* Descargar PDF */}
      <button
        type="button"
        onClick={handleDownloadPDF}
        className="w-full py-3 px-6 rounded-lg font-semibold text-lg bg-blue-600 hover:bg-blue-700 text-white transition-all"
      >
        📄 Descargar Presupuesto en PDF
      </button>

      {/* Enviar Email */}
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-lg transition-all ${
          loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-santander-red hover:bg-red-700 text-white"
        }`}
      >
        {loading ? "⏳ Enviando..." : "📧 Enviar Presupuesto a la Empresa"}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Al enviar, aceptas que tus datos sean utilizados para contactarte sobre tu presupuesto.
      </p>

    </form>
  )
}

export default CustomerForm