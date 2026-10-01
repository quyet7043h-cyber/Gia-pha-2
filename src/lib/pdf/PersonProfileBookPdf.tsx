import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { ClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { PersonDetail } from "@/lib/queries/persons";
import { computeLifespanYears } from "@/lib/lifespan";
import { formatPartialDate } from "@/lib/partialDate";
import { ensurePdfFontRegistered, PDF_FONT_FAMILY } from "./registerFont";

const PAGE_W = 595;
const PAGE_H = 842;
const PAD = 30;
const PHOTO_W = 104;
const PHOTO_H = 139;

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: PAD,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },
  frame: {
    position: "absolute",
    left: 18,
    top: 7,
    width: PAGE_W - 36,
    height: PAGE_H - 14,
    borderWidth: 1.4,
    borderColor: "#111111",
  },
  topDots: { width: 300, alignSelf: "center", marginTop: 2, marginBottom: 6, textAlign: "center", fontSize: 8, letterSpacing: 1.2 },
  headerArea: { position: "relative", minHeight: 0, paddingRight: 125 },
  row: { flexDirection: "row", alignItems: "flex-end", marginBottom: 2.5 },
  label: { fontSize: 10.5, marginRight: 5 },
  field: { flex: 1, minHeight: 11, borderBottomWidth: 0.55, borderBottomColor: "#777777", borderBottomStyle: "dotted", paddingBottom: 1 },
  shortField: { width: 92, minHeight: 12, borderBottomWidth: 0.55, borderBottomColor: "#777777", borderBottomStyle: "dotted", paddingBottom: 2 },
  mediumField: { width: 155, minHeight: 12, borderBottomWidth: 0.55, borderBottomColor: "#777777", borderBottomStyle: "dotted", paddingBottom: 2 },
  photoBox: { position: "absolute", right: 0, top: 0, width: PHOTO_W, height: PHOTO_H, borderWidth: 0.8, borderColor: "#888888", alignItems: "center", justifyContent: "center" },
  photo: { width: PHOTO_W, height: PHOTO_H, objectFit: "cover" },
  photoHint: { textAlign: "center", color: "#555555", fontSize: 9, lineHeight: 1.5 },
  sectionTitle: { fontSize: 11.5, fontWeight: 700, marginTop: 2, marginBottom: 3 },
  childrenTable: { borderWidth: 0.65, borderColor: "#777777", marginBottom: 5 },
  tableRow: { flexDirection: "row", minHeight: 13 },
  headerCell: { backgroundColor: "#F1F1F1", fontWeight: 700, textAlign: "center", justifyContent: "center" },
  cell: { paddingHorizontal: 5, paddingVertical: 1, justifyContent: "center", borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#888888", fontSize: 8.8 },
  cStt: { width: 42, textAlign: "center" }, cName: { width: 205 }, cGender: { width: 74, textAlign: "center" }, cBirth: { width: 88, textAlign: "center" }, cNote: { width: 125 },
  bottomRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  bottomLabel: { fontSize: 10.5, marginRight: 4 },
  halfField: { flex: 1, minHeight: 10, borderBottomWidth: 0.55, borderBottomColor: "#777777", borderBottomStyle: "dotted", paddingBottom: 2, marginRight: 18 },
  halfFieldLast: { flex: 1, minHeight: 15, borderBottomWidth: 0.55, borderBottomColor: "#777777", borderBottomStyle: "dotted", paddingBottom: 2 },
  noteTitle: { fontSize: 11.5, fontWeight: 700, marginTop: 3, marginBottom: 2 },
  noteLine: { minHeight: 15, borderBottomWidth: 0.55, borderBottomColor: "#777777", borderBottomStyle: "dotted", paddingBottom: 1, marginBottom: 1, fontSize: 8 },
});

interface Props { clan: ClanDetail; data: ClanBookData; photoByPersonId?: Map<string, string>; }

export function PersonProfileBookPdf({ clan, data, photoByPersonId }: Props) {
  ensurePdfFontRegistered();
  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const spouseByPerson = new Map<string, string[]>();
  const childrenByPerson = new Map<string, string[]>();
  const fatherByChild = new Map<string, string>();
  const motherByChild = new Map<string, string>();
  const familyById = new Map(data.families.map((f) => [f.id, f]));
  for (const family of data.families) if (family.husband_id && family.wife_id) { push(spouseByPerson, family.husband_id, family.wife_id); push(spouseByPerson, family.wife_id, family.husband_id); }
  const isLineage = (pid: string): boolean => { const p = personById.get(pid); return p?.is_root === true || data.childToFamily[pid] != null; };
  const bloodline = data.persons.filter((p) => isLineage(p.id));
  const inLaws = data.persons.filter((p) => !isLineage(p.id));
  for (const [childId, familyId] of Object.entries(data.childToFamily)) { const family = familyById.get(familyId); if (!family) continue; if (family.husband_id) fatherByChild.set(childId, family.husband_id); if (family.wife_id) motherByChild.set(childId, family.wife_id); const parent = family.husband_id && isLineage(family.husband_id) ? family.husband_id : family.wife_id && isLineage(family.wife_id) ? family.wife_id : family.husband_id ?? family.wife_id ?? null; if (parent) push(childrenByPerson, parent, childId); }
  for (const ids of childrenByPerson.values()) ids.sort((a, b) => compareChildren(personById.get(a), personById.get(b)));
  const minGen = bloodline.reduce((m, p) => Math.min(m, p.generation ?? Infinity), Infinity);
  const explicitRoots = bloodline.filter((p) => p.is_root);
  const roots = (explicitRoots.length > 0 ? explicitRoots : bloodline.filter((p) => p.generation === minGen)).sort(compareChildren);
  const sttById = new Map<string, string>();
  function assignStt(personId: string, prefix: string) { sttById.set(personId, prefix); const kids = (childrenByPerson.get(personId) ?? []).map((id) => personById.get(id)).filter((p): p is PersonDetail => !!p && p.generation !== null).sort(compareChildren); kids.forEach((k, i) => assignStt(k.id, prefix + "." + (i + 1))); }
  roots.forEach((r, i) => assignStt(r.id, String(i + 1)));
  let nextRoot = roots.length;
  const orphans = bloodline.filter((p) => !sttById.has(p.id)).sort((a, b) => (a.generation ?? 0) - (b.generation ?? 0) || compareChildren(a, b));
  for (const p of orphans) { if (sttById.has(p.id)) continue; assignStt(p.id, String(nextRoot + 1)); nextRoot++; }
  const bloodlineSorted = [...bloodline].sort((a, b) => (a.generation ?? 0) - (b.generation ?? 0) || compareStt(sttById.get(a.id) ?? "999999", sttById.get(b.id) ?? "999999"));
  const bloodlinePosition = new Map(bloodlineSorted.map((p, index) => [p.id, index]));
  const inLawsSorted = [...inLaws].sort((a, b) => { const key = (person: PersonDetail) => { const spouseIds = spouseByPerson.get(person.id) ?? []; const positions = spouseIds.map((id) => { const spouse = personById.get(id); if (!spouse) return null; const position = bloodlinePosition.get(spouse.id); return position == null ? null : { spouse, position }; }).filter((x): x is { spouse: PersonDetail; position: number } => x !== null); if (positions.length === 0) return { generation: Number.MAX_SAFE_INTEGER, position: Number.MAX_SAFE_INTEGER }; const first = positions.reduce((best, current) => current.position < best.position ? current : best); return { generation: first.spouse.generation ?? Number.MAX_SAFE_INTEGER, position: first.position }; }; const ka = key(a); const kb = key(b); return ka.generation - kb.generation || ka.position - kb.position || a.full_name.localeCompare(b.full_name, "vi"); });
  const people = [...bloodlineSorted, ...inLawsSorted];

  return <Document title={`Sổ gia phả - ${clan.name}`} author="Dòng Họ Việt" subject="Hồ sơ từng người trong sổ gia phả">
    {people.map((person) => {
      const spouseIds = spouseByPerson.get(person.id) ?? [];
      const spouses = spouseIds.map((id) => personById.get(id)).filter((p): p is PersonDetail => !!p);
      const childIds = unique(childrenByPerson.get(person.id) ?? []);
      const children = childIds.map((id) => personById.get(id)).filter((p): p is PersonDetail => !!p);
      const father = personById.get(fatherByChild.get(person.id) ?? "");
      const mother = personById.get(motherByChild.get(person.id) ?? "");
      const spouseText = spouses.map((p) => `${p.full_name}${p.birth_date ? ` (${formatDate(p.birth_date)})` : ""}`).join("; ");
      const spousePlace = spouses.map((p) => p.birth_place).filter(Boolean).join("; ");
      const birth = formatPartialDate({ date: person.birth_date, precision: person.birth_date_precision ?? null });
      const death = formatPartialDate({ date: person.death_date, precision: person.death_date_precision ?? null });
      const lifespan = person.lifespan_years ?? computeLifespanYears(person.birth_date, person.death_date);
      const saint = person.saint_name ? person.saint_name : "";
      const generation = person.generation == null ? "" : String(person.generation);
      const photo = photoByPersonId?.get(person.id);
      const noteLines = splitNote(person.bio ?? "");
      return <Page key={person.id} size={{ width: 595.28, height: 841.89 }} orientation="portrait" style={styles.page} wrap={false}>
        <View style={styles.frame} />
        <Text style={styles.topDots}>................................................................................</Text>
        <View style={styles.headerArea}>
          <View style={styles.row}><Text style={styles.label}>Họ và tên:</Text><Text style={styles.field}>{person.full_name}</Text><Text style={[styles.label, { marginLeft: 12 }]}>Tên thánh:</Text><Text style={styles.mediumField}>{saint}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Tên thường gọi:</Text><Text style={styles.field}>{person.nickname ?? ""}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Đời thứ:</Text><Text style={styles.shortField}>{generation}</Text><Text style={[styles.label, { marginLeft: 12 }]}>Ngày, tháng, năm sinh:</Text><Text style={styles.field}>{birth}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Thành tựu sự nghiệp:</Text><Text style={styles.field}>{""}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Vợ/Chồng:</Text><Text style={styles.field}>{spouseText}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Năm sinh:</Text><Text style={styles.shortField}>{spouses.map((p) => formatDate(p.birth_date)).filter(Boolean).join("; ")}</Text><Text style={[styles.label, { marginLeft: 12 }]}>Quê quán:</Text><Text style={styles.field}>{spousePlace || person.birth_place || ""}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Cha:</Text><Text style={styles.mediumField}>{father?.full_name ?? ""}</Text><Text style={[styles.label, { marginLeft: 12 }]}>Mẹ:</Text><Text style={styles.field}>{mother?.full_name ?? ""}</Text></View>
          <View style={styles.photoBox}>{photo ? <Image src={photo} style={styles.photo} /> : <Text style={styles.photoHint}>Ảnh{`\n`}3x4 / 4x6{`\n`}{`\n`} (Thêm ảnh tại đây)</Text>}</View>
        </View>
        <Text style={styles.sectionTitle}>THÔNG TIN CÁC CON</Text>
        <View style={styles.childrenTable}><View style={styles.tableRow}><Text style={[styles.cell, styles.cStt, styles.headerCell]}>STT</Text><Text style={[styles.cell, styles.cName, styles.headerCell]}>Họ và tên con</Text><Text style={[styles.cell, styles.cGender, styles.headerCell]}>Nam / Nữ</Text><Text style={[styles.cell, styles.cBirth, styles.headerCell]}>Năm sinh</Text><Text style={[styles.cell, styles.cNote, styles.headerCell]}>Ghi chú</Text></View>{Array.from({ length: Math.max(4, children.length) }, (_, i) => children[i] ?? null).map((child, i) => <View style={styles.tableRow} key={`${person.id}-child-${i}`}><Text style={[styles.cell, styles.cStt]}>{i + 1}</Text><Text style={[styles.cell, styles.cName]}>{child?.full_name ?? ""}</Text><Text style={[styles.cell, styles.cGender]}>{child ? (child.gender === "M" ? "Nam" : "Nữ") : ""}</Text><Text style={[styles.cell, styles.cBirth]}>{child ? formatDate(child.birth_date) : ""}</Text><Text style={[styles.cell, styles.cNote]}>{child?.birth_order ? `Con thứ ${child.birth_order}` : ""}</Text></View>)}</View>
        <View style={styles.bottomRow}><Text style={styles.bottomLabel}>Ngày, tháng, năm mất:</Text><Text style={styles.halfField}>{death}</Text><Text style={styles.bottomLabel}>Hưởng thọ / Hưởng dương:</Text><Text style={styles.halfFieldLast}>{lifespan == null ? "" : `${lifespan} tuổi`}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Nơi an táng / Mộ phần hiện nay:</Text><Text style={styles.field}>{person.burial_place ?? ""}</Text></View>
        <Text style={styles.noteTitle}>V. GHI CHÚ / TIỂU SỬ / DẪN ĐỒ KHÁC</Text>
        {noteLines.length > 0 ? noteLines.map((line, i) => <Text key={i} style={styles.noteLine}>{line}</Text>) : Array.from({ length: 3 }, (_, i) => <Text key={i} style={styles.noteLine}> </Text>)}
      </Page>;
    })}
  </Document>;
}

function push(map: Map<string, string[]>, key: string, value: string) { const arr = map.get(key) ?? []; if (!arr.includes(value)) arr.push(value); map.set(key, arr); }
function unique(values: string[]): string[] { return [...new Set(values)]; }
function compareStt(a: string, b: string): number { const aa = a.split(".").map((n) => Number(n)); const bb = b.split(".").map((n) => Number(n)); const len = Math.max(aa.length, bb.length); for (let i = 0; i < len; i++) { const d = (aa[i] ?? Number.MAX_SAFE_INTEGER) - (bb[i] ?? Number.MAX_SAFE_INTEGER); if (d !== 0) return d; } return 0; }
function compareChildren(a?: PersonDetail, b?: PersonDetail): number { if (!a || !b) return a ? -1 : b ? 1 : 0; return (a.birth_order ?? 999999) - (b.birth_order ?? 999999) || (a.birth_date ?? "9999-99-99").localeCompare(b.birth_date ?? "9999-99-99") || a.full_name.localeCompare(b.full_name, "vi"); }
function formatDate(value?: string | null): string { if (!value) return ""; const [y, m, d] = value.split("-"); if (!y) return ""; if (!m) return y; if (!d) return `${m}/${y}`; return `${d}/${m}/${y}`; }
function splitNote(note: string): string[] { const lines = note.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); return lines.slice(0, 8); }
