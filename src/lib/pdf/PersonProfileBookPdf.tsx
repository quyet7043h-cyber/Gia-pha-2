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
    width: PAGE_W,
    height: PAGE_H,
    paddingTop: 28,
    paddingBottom: 28,
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
  topDots: {
    width: 300,
    alignSelf: "center",
    marginTop: 2,
    marginBottom: 18,
    textAlign: "center",
    fontSize: 8,
    letterSpacing: 1.2,
  },
  headerArea: {
    position: "relative",
    minHeight: 0,
    paddingRight: 125,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  label: {
    fontSize: 10.5,
    marginRight: 5,
  },
  field: {
    flex: 1,
    minHeight: 15,
    borderBottomWidth: 0.55,
    borderBottomColor: "#777777",
    borderBottomStyle: "dotted",
    paddingBottom: 2,
  },
  shortField: {
    width: 92,
    minHeight: 15,
    borderBottomWidth: 0.55,
    borderBottomColor: "#777777",
    borderBottomStyle: "dotted",
    paddingBottom: 2,
  },
  mediumField: {
    width: 155,
    minHeight: 15,
    borderBottomWidth: 0.55,
    borderBottomColor: "#777777",
    borderBottomStyle: "dotted",
    paddingBottom: 2,
  },
  photoBox: {
    position: "absolute",
    right: 0,
    top: 0,
    width: PHOTO_W,
    height: PHOTO_H,
    borderWidth: 0.8,
    borderColor: "#888888",
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    width: PHOTO_W,
    height: PHOTO_H,
    objectFit: "cover",
  },
  photoHint: {
    textAlign: "center",
    color: "#555555",
    fontSize: 9,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 6,
  },
  childrenTable: {
    borderWidth: 0.65,
    borderColor: "#777777",
    marginBottom: 17,
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 20,
  },
  headerCell: {
    backgroundColor: "#F1F1F1",
    fontWeight: 700,
    textAlign: "center",
    justifyContent: "center",
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    justifyContent: "center",
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#888888",
    fontSize: 8.8,
  },
  cStt: { width: 42, textAlign: "center" },
  cName: { width: 205 },
  cGender: { width: 74, textAlign: "center" },
  cBirth: { width: 88, textAlign: "center" },
  cNote: { width: 125 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  bottomLabel: { fontSize: 10.5, marginRight: 4 },
  halfField: {
    flex: 1,
    minHeight: 15,
    borderBottomWidth: 0.55,
    borderBottomColor: "#777777",
    borderBottomStyle: "dotted",
    paddingBottom: 2,
    marginRight: 18,
  },
  halfFieldLast: {
    flex: 1,
    minHeight: 15,
    borderBottomWidth: 0.55,
    borderBottomColor: "#777777",
    borderBottomStyle: "dotted",
    paddingBottom: 2,
  },
  noteTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 6,
  },
  noteLine: {
    minHeight: 20,
    borderBottomWidth: 0.55,
    borderBottomColor: "#777777",
    borderBottomStyle: "dotted",
    paddingBottom: 3,
    marginBottom: 3,
    fontSize: 9.5,
  },
});

interface Props {
  clan: ClanDetail;
  data: ClanBookData;
  photoByPersonId?: Map<string, string>;
}

export function PersonProfileBookPdf({ clan, data, photoByPersonId }: Props) {
  ensurePdfFontRegistered();

  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const spouseByPerson = new Map<string, string[]>();
  const childrenByPerson = new Map<string, string[]>();
  const fatherByChild = new Map<string, string>();
  const motherByChild = new Map<string, string>();

  for (const family of data.families) {
    if (family.husband_id && family.wife_id) {
      push(spouseByPerson, family.husband_id, family.wife_id);
      push(spouseByPerson, family.wife_id, family.husband_id);
    }
  }

  for (const [childId, familyId] of Object.entries(data.childToFamily)) {
    const family = data.families.find((f) => f.id === familyId);
    if (!family) continue;
    if (family.husband_id) {
      fatherByChild.set(childId, family.husband_id);
      push(childrenByPerson, family.husband_id, childId);
    }
    if (family.wife_id) {
      motherByChild.set(childId, family.wife_id);
      push(childrenByPerson, family.wife_id, childId);
    }
  }

  for (const ids of childrenByPerson.values()) {
    ids.sort((a, b) => compareChildren(personById.get(a), personById.get(b)));
  }

  const people = [...data.persons].sort((a, b) => {
    return (
      (a.generation ?? Number.MAX_SAFE_INTEGER) -
        (b.generation ?? Number.MAX_SAFE_INTEGER) ||
      compareChildren(a, b) ||
      a.full_name.localeCompare(b.full_name, "vi")
    );
  });

  return (
    <Document
      title={`Sổ gia phả - ${clan.name}`}
      author="Dòng Họ Việt"
      subject="Hồ sơ từng người trong sổ gia phả"
    >
      {people.map((person) => {
        const spouseIds = spouseByPerson.get(person.id) ?? [];
        const spouses = spouseIds
          .map((id) => personById.get(id))
          .filter((p): p is PersonDetail => !!p);
        const childIds = unique(childrenByPerson.get(person.id) ?? []);
        const children = childIds
          .map((id) => personById.get(id))
          .filter((p): p is PersonDetail => !!p);

        const spouseFathers = spouses
          .map((spouse) => personById.get(fatherByChild.get(spouse.id) ?? ""))
          .filter((p): p is PersonDetail => !!p);
        const spouseMothers = spouses
          .map((spouse) => personById.get(motherByChild.get(spouse.id) ?? ""))
          .filter((p): p is PersonDetail => !!p);

        const spouseText = spouses.map((p) => p.full_name).join("; ");
        const spouseBirthText = spouses
          .map((p) =>
            formatPartialDate({
              date: p.birth_date,
              precision: p.birth_date_precision ?? null,
            }),
          )
          .filter(Boolean)
          .join("; ");
        const spousePlace = spouses
          .map((p) => p.birth_place)
          .filter(Boolean)
          .join("; ");
        const spouseFatherText = unique(spouseFathers.map((p) => p.full_name)).join("; ");
        const spouseMotherText = unique(spouseMothers.map((p) => p.full_name)).join("; ");

        const birth = formatPartialDate({
          date: person.birth_date,
          precision: person.birth_date_precision ?? null,
        });
        const death = formatPartialDate({
          date: person.death_date,
          precision: person.death_date_precision ?? null,
        });
        const lifespan = person.lifespan_years ?? computeLifespanYears(person.birth_date, person.death_date);
        const saint = person.saint_name ? person.saint_name : "";
        const generation = person.generation == null ? "" : String(person.generation);
        const career = person.bio ?? "";
        const photo = photoByPersonId?.get(person.id);
        const noteLines = splitNote(person.bio ?? "");

        return (
          <Page key={person.id} size="A4" style={styles.page} wrap={false}>
            <View style={styles.frame} />
            <Text style={styles.topDots}>................................................................................</Text>

            <View style={styles.headerArea}>
              <View style={styles.row}>
                <Text style={styles.label}>Họ và tên:</Text>
                <Text style={styles.field}>{person.full_name}</Text>
                <Text style={[styles.label, { marginLeft: 12 }]}>Tên thánh:</Text>
                <Text style={styles.mediumField}>{saint}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Tên thường gọi:</Text>
                <Text style={styles.field}>{person.nickname ?? ""}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Đời thứ:</Text>
                <Text style={styles.shortField}>{generation}</Text>
                <Text style={[styles.label, { marginLeft: 12 }]}>Ngày, tháng, năm sinh:</Text>
                <Text style={styles.field}>{birth}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Thành tựu sự nghiệp:</Text>
                <Text style={styles.field}>{career}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Vợ/Chồng:</Text>
                <Text style={styles.field}>{spouseText}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Năm sinh:</Text>
                <Text style={styles.shortField}>{spouseBirthText}</Text>
                <Text style={[styles.label, { marginLeft: 12 }]}>Quê quán:</Text>
                <Text style={styles.field}>{spousePlace || person.birth_place || ""}</Text>
              </View>
              <View style={[styles.row, { marginBottom: 0 }] }>
                <Text style={styles.label}>Cha:</Text>
                <Text style={styles.mediumField}>{spouseFatherText}</Text>
                <Text style={[styles.label, { marginLeft: 12 }]}>Mẹ:</Text>
                <Text style={styles.field}>{spouseMotherText}</Text>
              </View>
              <View style={styles.photoBox}>
                {photo ? (
                  <Image src={photo} style={styles.photo} />
                ) : (
                  <Text style={styles.photoHint}>Ảnh{`\n`}3x4 / 4x6{`\n`}{`\n`} (Thêm ảnh tại đây)</Text>
                )}
              </View>
            </View>

            <Text style={styles.sectionTitle}>THÔNG TIN CÁC CON</Text>
            <View style={styles.childrenTable}>
              <View style={styles.tableRow}>
                <Text style={[styles.cell, styles.cStt, styles.headerCell]}>STT</Text>
                <Text style={[styles.cell, styles.cName, styles.headerCell]}>Họ và tên con</Text>
                <Text style={[styles.cell, styles.cGender, styles.headerCell]}>Nam / Nữ</Text>
                <Text style={[styles.cell, styles.cBirth, styles.headerCell]}>Năm sinh</Text>
                <Text style={[styles.cell, styles.cNote, styles.headerCell]}>Ghi chú</Text>
              </View>
              {Array.from({ length: Math.max(5, children.length) }, (_, i) => children[i] ?? null).map((child, i) => (
                <View style={styles.tableRow} key={`${person.id}-child-${i}`}>
                  <Text style={[styles.cell, styles.cStt]}>{i + 1}</Text>
                  <Text style={[styles.cell, styles.cName]}>{child?.full_name ?? ""}</Text>
                  <Text style={[styles.cell, styles.cGender]}>{child ? (child.gender === "M" ? "Nam" : "Nữ") : ""}</Text>
                  <Text style={[styles.cell, styles.cBirth]}>
                    {child
                      ? formatPartialDate({
                          date: child.birth_date,
                          precision: child.birth_date_precision ?? null,
                        })
                      : ""}
                  </Text>
                  <Text style={[styles.cell, styles.cNote]}>{child?.birth_order ? `Con thứ ${child.birth_order}` : ""}</Text>
                </View>
              ))}
            </View>

            <View style={styles.bottomRow}>
              <Text style={styles.bottomLabel}>Ngày, tháng, năm mất:</Text>
              <Text style={styles.halfField}>{death}</Text>
              <Text style={styles.bottomLabel}>Hưởng thọ / Hưởng dương:</Text>
              <Text style={styles.halfFieldLast}>{lifespan == null ? "" : `${lifespan} tuổi`}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Nơi an táng / Mộ phần hiện nay:</Text>
              <Text style={styles.field}>{person.burial_place ?? ""}</Text>
            </View>

            <Text style={styles.noteTitle}>V. GHI CHÚ / TIỂU SỬ / DẪN ĐỒ KHÁC</Text>
            {Array.from({ length: 8 }, (_, i) => (
              <Text key={i} style={styles.noteLine}>{noteLines[i] ?? " "}</Text>
            ))}
          </Page>
        );
      })}
    </Document>
  );
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const arr = map.get(key) ?? [];
  if (!arr.includes(value)) arr.push(value);
  map.set(key, arr);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function compareChildren(a?: PersonDetail, b?: PersonDetail): number {
  if (!a || !b) return 0;
  if (a.birth_order != null || b.birth_order != null) {
    return (a.birth_order ?? Number.MAX_SAFE_INTEGER) - (b.birth_order ?? Number.MAX_SAFE_INTEGER);
  }
  return (a.birth_date ?? "9999-99-99").localeCompare(b.birth_date ?? "9999-99-99") || a.full_name.localeCompare(b.full_name, "vi");
}

function splitNote(text: string): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > 82) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 8);
}
