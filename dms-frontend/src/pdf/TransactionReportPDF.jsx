import {
  Document,
  Page,
  View,
  Text,
  Image, // 🆕
  StyleSheet,
  // Font,
} from '@react-pdf/renderer';

// 1)  Optional — embed Libre Franklin so the PDF uses the same font
//     (Be sure the TTFs are reachable at /fonts/... as we discussed.)
/*
const BASE = `${window.location.origin}/fonts`;
Font.register({
  family: 'Libre Franklin',
  fonts: [
    { src: `${BASE}/LibreFranklin-Regular.ttf` },
    { src: `${BASE}/LibreFranklin-Bold.ttf`, fontWeight: 700 },
  ],
});
*/

const styles = StyleSheet.create({
  page:       { fontSize: 11, padding: 32, lineHeight: 1.4 },
  title:      { fontSize: 14, fontWeight: 700, textAlign: 'center' },
  subtitle:   { textAlign: 'center', marginBottom: 12 },
  flexRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  companyBox: { maxWidth: 210, lineHeight: 1.3 },
  table:      { marginTop: 12 },
  th:         { width: 100, fontWeight: 700 },
  ul:         { marginLeft: 14, marginTop: 2 },
  li:         { marginBottom: 2 },
  section:    { marginBottom: 16 },
  footer:     { textAlign: 'right', marginTop: 28, fontWeight: 700 },
  hr:         { marginTop: 16, borderBottomWidth: 1, borderColor: '#999' },
  photo:      { marginTop: 6, maxWidth: '100%', height: 220, objectFit: 'contain' },
});

const fmt = (d, withTime = false) => {
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return new Date(d).toLocaleString('id-ID', opts);
};

export default function TransactionReportPDF({ doc, support }) {
  const grand =
    doc.parsed_json?.find((s) => s.grand_total)?.grand_total ?? '-';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ---------- Header ---------- */}
        <Text style={styles.title}>PT. TUNGGAL TUNGGUL UNGGUL</Text>
        <Text style={styles.subtitle}>
          Laporan Transaksi QLOLA tanggal {fmt(doc.created_at)}
        </Text>

        <View style={styles.flexRow}>
          <View /> {/* Empty flex to push address box right */}
          <View style={styles.companyBox}>
            <Text>Alamat: Jl. Lokomotif no 31, Sekip</Text>
            <Text>Lima Puluh, Pekanbaru, Riau</Text>
            <Text>Email: alamsuburnusantara@gmail.com</Text>
            <Text>Phone: +62&nbsp;811&nbsp;751&nbsp;969</Text>
          </View>
        </View>

        {/* ---------- Basic facts ---------- */}
        <View style={styles.table}>
          <View style={styles.flexRow}>
            <Text style={styles.th}>Kode dokumen</Text>
            <Text>: {doc.document_code}</Text>
          </View>
          <View style={styles.flexRow}>
            <Text style={styles.th}>Disetujui oleh</Text>
            <Text>
              : Pak Subardi pada {doc.approved_at ? fmt(doc.approved_at, true) : '—'}
            </Text>
          </View>
        </View>

        {/* ---------- Sections ---------- */}
        {doc.parsed_json
          ?.filter((s) => s.table)
          .map((sec, i) => {
            const hdr     = sec.table[0] || [];
            const payIdx  = hdr.indexOf('PAY_REF');

            return (
              <View key={i} style={styles.section}>
                <Text style={{ fontWeight: 700 }}>
                  {String.fromCharCode(65 + i)}. {sec.company || 'Section'}
                </Text>

                {sec.table.slice(1).map((row, j) => {
                  const [, ket, dibayar, bank, ship] = row;
                  const pay =
                    payIdx !== -1 && row.length > payIdx
                      ? String(row[payIdx] || '').trim()
                      : '';

                  return (
                    <View key={j} wrap={false} style={styles.ul}>
                      <Text style={styles.li}>{ket}</Text>
                      <View style={styles.ul}>
                        {!!dibayar && (
                          <Text style={styles.li}>Dibayar ke: {dibayar}</Text>
                        )}
                        {!!bank && <Text style={styles.li}>Bank: {bank}</Text>}
                        {!!ship && (
                          <Text style={styles.li}>Pengiriman: {ship}</Text>
                        )}
                        {!!pay && (
                          <Text style={styles.li}>Referensi&nbsp;Bayar: {pay}</Text>
                        )}
                      </View>

                      {/*
                           ─────────  Supporting images for this item  ─────────
                           Match by section_index & row_index; only show images.
                      */}
                      {support
                        .filter(
                          (d) =>
                            d.section_index === i &&
                            d.row_index === j &&
                            /\.(png|jpe?g)$/i.test(d.file)
                        )
                        .map((d, k) => (
                          <Image key={k} src={d.file} style={styles.photo} />
                        ))}
                    </View>
                  );
                })}
              </View>
            );
          })}

        {/* ---------- Supporting docs ---------- */}
        <Text style={{ fontWeight: 700, marginBottom: 4 }}>Dokumen pendukung:</Text>
        {support.length ? (
          <View style={styles.ul}>
            {support.map((d) => (
              <Text key={d.id} style={styles.li}>
                • {d.title || 'Dokumen pendukung'}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={{ marginLeft: 14 }}>—</Text>
        )}

        <View style={styles.hr} />

        {/* ---------- Footer ---------- */}
        <Text style={styles.footer}>
          TOTAL CEK YANG DIBUKA: Rp {grand}
        </Text>
      </Page>
    </Document>
  );
}
