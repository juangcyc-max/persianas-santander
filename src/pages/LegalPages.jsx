// ── Componente reutilizable para páginas legales ──────────────────────────
function LegalPage({ title, lastUpdate, children }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-2">Última actualización: {lastUpdate}</p>
        </div>
      </div>
      {/* Contenido */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
          {children}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-3 pt-4 border-t border-gray-100">{title}</h2>
      <div className="text-sm leading-relaxed text-gray-600 space-y-2">{children}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// POLÍTICA DE PRIVACIDAD
// ══════════════════════════════════════════════════════════════════════════
export function PoliticaPrivacidad() {
  return (
    <LegalPage title="Política de Privacidad" lastUpdate="29 de marzo de 2026">
      <Section title="1. Responsable del tratamiento">
        <p><strong>Persianas Santander S.L.</strong></p>
        <p>Polígono Industrial Nueva Montaña, Santander, Cantabria</p>
        <p>Email: info@persianassantander.com | Teléfono: 942 00 00 00</p>
      </Section>

      <Section title="2. Datos que recopilamos">
        <p>Recopilamos los siguientes datos personales:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nombre y apellidos</li>
          <li>Dirección de correo electrónico</li>
          <li>Número de teléfono</li>
          <li>Dirección postal (para instalaciones)</li>
          <li>Datos de empresa (solo cuentas profesionales): razón social, CIF/NIF, dirección fiscal</li>
          <li>Configuraciones de persianas guardadas</li>
          <li>Datos de navegación y uso de la web</li>
        </ul>
      </Section>

      <Section title="3. Finalidad del tratamiento">
        <ul className="list-disc pl-5 space-y-1">
          <li>Gestionar el registro y acceso a la cuenta de usuario</li>
          <li>Procesar solicitudes de presupuesto y pedidos</li>
          <li>Coordinar citas de medición e instalación</li>
          <li>Enviar comunicaciones relacionadas con los pedidos</li>
          <li>Gestionar la facturación de clientes profesionales</li>
          <li>Mejorar nuestros servicios y la experiencia de usuario</li>
        </ul>
      </Section>

      <Section title="4. Base legal">
        <p>El tratamiento de sus datos se basa en:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Ejecución de contrato:</strong> para gestionar pedidos y presupuestos</li>
          <li><strong>Consentimiento:</strong> para comunicaciones comerciales</li>
          <li><strong>Interés legítimo:</strong> para mejorar nuestros servicios</li>
          <li><strong>Obligación legal:</strong> para la emisión de facturas</li>
        </ul>
      </Section>

      <Section title="5. Conservación de datos">
        <p>Conservamos sus datos durante el tiempo necesario para la finalidad para la que fueron recogidos y, en todo caso, durante los plazos legalmente establecidos:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Datos de clientes: 5 años desde el último pedido</li>
          <li>Datos de facturación: 10 años (obligación fiscal)</li>
          <li>Datos de navegación: 13 meses</li>
        </ul>
      </Section>

      <Section title="6. Destinatarios">
        <p>No cedemos sus datos a terceros, salvo:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase Inc.</strong> — proveedor de base de datos (servidores en la UE)</li>
          <li><strong>Vercel Inc.</strong> — proveedor de alojamiento web</li>
          <li><strong>Obligación legal:</strong> cuando sea requerido por ley</li>
        </ul>
      </Section>

      <Section title="7. Sus derechos">
        <p>Puede ejercer los siguientes derechos enviando un email a <strong>info@persianassantander.com</strong>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Acceso:</strong> conocer qué datos tenemos sobre usted</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos</li>
          <li><strong>Supresión:</strong> eliminar sus datos</li>
          <li><strong>Oposición:</strong> oponerse al tratamiento</li>
          <li><strong>Portabilidad:</strong> recibir sus datos en formato electrónico</li>
          <li><strong>Limitación:</strong> restringir el tratamiento</li>
        </ul>
        <p className="mt-2">También puede reclamar ante la <strong>Agencia Española de Protección de Datos</strong> (www.aepd.es).</p>
      </Section>

      <Section title="8. Seguridad">
        <p>Aplicamos medidas técnicas y organizativas apropiadas para proteger sus datos, incluyendo cifrado SSL, autenticación segura y acceso restringido a los datos personales.</p>
      </Section>
    </LegalPage>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// POLÍTICA DE COOKIES
// ══════════════════════════════════════════════════════════════════════════
export function PoliticaCookies() {
  return (
    <LegalPage title="Política de Cookies" lastUpdate="29 de marzo de 2026">
      <Section title="1. ¿Qué son las cookies?">
        <p>Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita nuestra web. Nos ayudan a recordar sus preferencias y a mejorar su experiencia.</p>
      </Section>

      <Section title="2. Cookies que utilizamos">
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">Cookie</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">Finalidad</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['sb-auth-token', 'Necesaria', 'Mantener la sesión de usuario iniciada', 'Sesión'],
                ['sb-refresh-token', 'Necesaria', 'Renovar el token de autenticación', '1 año'],
                ['_vercel_*', 'Técnica', 'Funcionamiento del alojamiento web', 'Sesión'],
              ].map(([name, type, purpose, duration]) => (
                <tr key={name}>
                  <td className="px-3 py-2 font-mono text-gray-600">{name}</td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${type === 'Necesaria' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{type}</span></td>
                  <td className="px-3 py-2 text-gray-600">{purpose}</td>
                  <td className="px-3 py-2 text-gray-600">{duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="3. Cookies de terceros">
        <p>Utilizamos los siguientes servicios que pueden instalar sus propias cookies:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Google (OAuth):</strong> para el inicio de sesión con Google. Consulte la política de Google en policies.google.com</li>
          <li><strong>Supabase:</strong> para la autenticación y base de datos</li>
        </ul>
      </Section>

      <Section title="4. Gestión de cookies">
        <p>Puede gestionar o eliminar las cookies desde la configuración de su navegador:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Chrome:</strong> Configuración → Privacidad y seguridad → Cookies</li>
          <li><strong>Firefox:</strong> Opciones → Privacidad y seguridad</li>
          <li><strong>Safari:</strong> Preferencias → Privacidad</li>
          <li><strong>Edge:</strong> Configuración → Privacidad, búsqueda y servicios</li>
        </ul>
        <p className="mt-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          ⚠️ Deshabilitar las cookies necesarias puede impedir el correcto funcionamiento de la web, incluyendo el inicio de sesión.
        </p>
      </Section>

      <Section title="5. Actualizaciones">
        <p>Podemos actualizar esta política en cualquier momento. Le notificaremos los cambios relevantes a través de un aviso en la web.</p>
      </Section>
    </LegalPage>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TÉRMINOS Y CONDICIONES
// ══════════════════════════════════════════════════════════════════════════
export function TerminosCondiciones() {
  return (
    <LegalPage title="Términos y Condiciones" lastUpdate="29 de marzo de 2026">
      <Section title="1. Información general">
        <p><strong>Persianas Santander S.L.</strong> (en adelante, "la empresa") es titular del sitio web persianassantander.com.</p>
        <p>Polígono Industrial Nueva Montaña, Santander, Cantabria</p>
        <p>Email: info@persianassantander.com</p>
      </Section>

      <Section title="2. Objeto">
        <p>Los presentes Términos y Condiciones regulan el acceso y uso del sitio web, así como la contratación de productos y servicios ofrecidos por Persianas Santander S.L.</p>
      </Section>

      <Section title="3. Proceso de compra">
        <ul className="list-disc pl-5 space-y-1">
          <li>Los presupuestos generados a través del configurador son <strong>orientativos</strong>. El precio definitivo se confirmará tras la visita de medición.</li>
          <li>Para clientes particulares, es obligatoria una visita previa de medición antes de confirmar el pedido.</li>
          <li>Los clientes profesionales pueden solicitar pedidos directamente sin visita previa.</li>
          <li>El contrato se perfecciona cuando la empresa confirma el pedido por escrito (email).</li>
        </ul>
      </Section>

      <Section title="4. Precios">
        <ul className="list-disc pl-5 space-y-1">
          <li>Todos los precios mostrados en el configurador incluyen IVA al 21%.</li>
          <li>Los clientes profesionales registrados tienen un descuento del 20% sobre el precio base.</li>
          <li>Los precios pueden variar según las medidas exactas confirmadas en la visita técnica.</li>
        </ul>
      </Section>

      <Section title="5. Plazos de entrega">
        <p>El plazo de fabricación e instalación es de <strong>7 a 15 días hábiles</strong> desde la confirmación del pedido, salvo causa de fuerza mayor o acuerdo expreso entre las partes.</p>
      </Section>

      <Section title="6. Garantía">
        <p>Todos nuestros productos tienen una garantía de <strong>10 años</strong> contra defectos de fabricación, conforme a la normativa europea de garantía de productos. La garantía no cubre:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Daños por uso incorrecto o falta de mantenimiento</li>
          <li>Daños causados por agentes externos (vandalism, accidentes)</li>
          <li>Desgaste normal por el uso</li>
        </ul>
      </Section>

      <Section title="7. Derecho de desistimiento">
        <p>Al tratarse de productos fabricados a medida y personalizados, <strong>no aplica el derecho de desistimiento</strong> de 14 días establecido en el RDL 1/2007, conforme al artículo 103.c) de dicha norma.</p>
      </Section>

      <Section title="8. Propiedad intelectual">
        <p>Todos los contenidos del sitio web (textos, imágenes, diseño, código) son propiedad de Persianas Santander S.L. o de sus proveedores de contenido, y están protegidos por las leyes de propiedad intelectual.</p>
      </Section>

      <Section title="9. Limitación de responsabilidad">
        <p>La empresa no se responsabiliza de los daños que puedan derivarse del uso incorrecto de los productos instalados o de informaciones inexactas proporcionadas por el cliente (medidas, características del hueco, etc.).</p>
      </Section>

      <Section title="10. Legislación aplicable">
        <p>Estos términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales de <strong>Santander</strong>, salvo que la ley establezca otro fuero imperativo.</p>
      </Section>

      <Section title="11. Contacto">
        <p>Para cualquier consulta sobre estos términos: <strong>info@persianassantander.com</strong> | 942 00 00 00</p>
      </Section>
    </LegalPage>
  )
}
