# -*- coding: utf-8 -*-
"""
Spillburg Holdings Enterprise Portal - Pure Python OpenXML (.xlsx) Exporter
Generates 100% valid, repair-free Excel spreadsheets with Calibri size 8 styling.
Zero third-party pip dependencies required. Built with Python 3 Standard Library.
"""

import io
import zipfile
import xml.sax.saxutils as saxutils

def escape_xml(s):
    if s is None:
        return ""
    return saxutils.escape(str(s))

def generate_payroll_xlsx(enriched_period, company_info=None):
    """
    Generates a 100% compliant OpenXML (.xlsx) binary stream in Calibri size 8
    matching the exact corporate payroll table structure with zero repair errors.
    """
    comp = company_info or {}
    currency_mode = comp.get("currencyMode") or enriched_period.get("currencyMode") or "dual"
    base_curr = comp.get("foreignCurrency") or enriched_period.get("baseCurrency") or "GBP"
    month = enriched_period.get("month", "Period")
    rate = float(enriched_period.get("exchangeRate", 440.0) or 440.0)
    employees = enriched_period.get("employees", [])
    totals = enriched_period.get("totals", {})

    rate_disp = int(rate) if rate == int(rate) else rate

    sheet_rows = []
    current_row_idx = 1
    col_letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"]

    if currency_mode == "dual":
        # ==========================================
        # TABLE 1: FOREIGN BASE CURRENCY (e.g. GBP)
        # ==========================================
        title1 = f"SALARY SHEET (IN {base_curr} ) - {month.upper()}"
        sheet_rows.append((current_row_idx, [("A", 6, "inlineStr", title1)]))
        current_row_idx += 1

        t1_headers = [
            ("No", 7),
            ("Employee Name", 8),
            ("POSITION", 8),
            (f"{base_curr} Salary", 9),
            ("Working Days", 7),
            (f"Earned Base ({base_curr})", 9),
            ("EPF (12% )", 9),
            ("ETF(3% )", 9),
            (f"Total Employer Cost ({base_curr})", 9),
            ("BANK ACCOUNT NO", 7),
            ("TIN NO", 7),
            ("IDNO", 7),
            ("Date Joined", 7)
        ]
        row_cells = []
        for c_idx, (h_text, s_idx) in enumerate(t1_headers):
            row_cells.append((col_letters[c_idx], s_idx, "inlineStr", h_text))
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        for e in employees:
            bank_str = f"{e.get('bankAccountNo','')}({e.get('bankCode','')})" if e.get('bankCode') else str(e.get('bankAccountNo',''))
            row_cells = [
                ("A", 11, "num", e.get("no", "")),
                ("B", 10, "inlineStr", e.get("name", "")),
                ("C", 10, "inlineStr", e.get("position", "")),
                ("D", 13, "num", e.get("gbpSalary", 0)),
                ("E", 11, "inlineStr", e.get("workDays", "")),
                ("F", 13, "num", e.get("earnedGbp", 0)),
                ("G", 12, "num", e.get("epf12Gbp", 0)),
                ("H", 12, "num", e.get("etf3Gbp", 0)),
                ("I", 14, "num", e.get("totalGbp", 0)),
                ("J", 10, "inlineStr", bank_str),
                ("K", 11, "inlineStr", e.get("tinNo", "")),
                ("L", 11, "inlineStr", e.get("idNo", "")),
                ("M", 11, "inlineStr", e.get("dateJoined", ""))
            ]
            sheet_rows.append((current_row_idx, row_cells))
            current_row_idx += 1

        # Table 1 Totals
        row_cells = [
            ("A", 15, "inlineStr", "TOTAL"),
            ("B", 15, "inlineStr", ""),
            ("C", 15, "inlineStr", ""),
            ("D", 17, "num", totals.get("sumGbpSalary", 0)),
            ("E", 15, "inlineStr", ""),
            ("F", 17, "num", totals.get("sumEarnedGbp", 0)),
            ("G", 16, "num", totals.get("sumEpf12Gbp", 0)),
            ("H", 16, "num", totals.get("sumEtf3Gbp", 0)),
            ("I", 17, "num", totals.get("sumTotalGbp", 0)),
            ("J", 15, "inlineStr", ""),
            ("K", 15, "inlineStr", ""),
            ("L", 15, "inlineStr", ""),
            ("M", 15, "inlineStr", "")
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        # Sign-off row
        checked_str = f"Checked by: {enriched_period.get('checkedBy','')}, {enriched_period.get('checkedTitle','Accountant')}"
        auth_str = f"Authorized by: {enriched_period.get('authorizedSignatory','')}, {enriched_period.get('authorizedCompany','')}"
        row_cells = [
            ("A", 18, "inlineStr", checked_str),
            ("F", 18, "inlineStr", auth_str)
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 2

        # ==========================================
        # TABLE 2: LKR REMITTANCE TABLE
        # ==========================================
        title2 = f"SALARY SHEET (IN LKR) - {month.upper()} @ {rate_disp}"
        sheet_rows.append((current_row_idx, [("A", 6, "inlineStr", title2)]))
        current_row_idx += 1

        t2_headers = [
            ("No", 7),
            ("Employee Name", 8),
            ("POSITION", 8),
            (f"{base_curr} Salary", 9),
            ("Working Days", 7),
            (f"Earned Base ({base_curr})", 9),
            ("LKR", 9),
            ("EPF 8%", 9),
            ("EPF12%", 9),
            ("ETF 3%", 9),
            ("APIT", 9),
            ("Other Deductions", 9),
            ("Net Remittance (LKR)", 9)
        ]
        row_cells = []
        for c_idx, (h_text, s_idx) in enumerate(t2_headers):
            row_cells.append((col_letters[c_idx], s_idx, "inlineStr", h_text))
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        for e in employees:
            row_cells = [
                ("A", 11, "num", e.get("no", "")),
                ("B", 10, "inlineStr", e.get("name", "")),
                ("C", 10, "inlineStr", e.get("position", "")),
                ("D", 13, "num", e.get("gbpSalary", 0)),
                ("E", 11, "inlineStr", e.get("workDays", "")),
                ("F", 13, "num", e.get("earnedGbp", 0)),
                ("G", 12, "num", e.get("lkrGross", 0)),
                ("H", 12, "num", e.get("epf8Lkr", 0)),
                ("I", 12, "num", e.get("epf12Lkr", 0)),
                ("J", 12, "num", e.get("etf3Lkr", 0)),
                ("K", 12, "num", e.get("apit", 0)),
                ("L", 11, "inlineStr", ""),
                ("M", 14, "num", e.get("netSalaryLkr", 0))
            ]
            sheet_rows.append((current_row_idx, row_cells))
            current_row_idx += 1

        row_cells = [
            ("A", 15, "inlineStr", "TOTAL"),
            ("B", 15, "inlineStr", ""),
            ("C", 15, "inlineStr", ""),
            ("D", 17, "num", totals.get("sumGbpSalary", 0)),
            ("E", 15, "inlineStr", ""),
            ("F", 17, "num", totals.get("sumEarnedGbp", 0)),
            ("G", 16, "num", totals.get("sumLkrGross", 0)),
            ("H", 16, "num", totals.get("sumEpf8Lkr", 0)),
            ("I", 16, "num", totals.get("sumEpf12Lkr", 0)),
            ("J", 16, "num", totals.get("sumEtf3Lkr", 0)),
            ("K", 16, "num", totals.get("sumApitLkr", 0)),
            ("L", 15, "inlineStr", ""),
            ("M", 17, "num", totals.get("sumNetSalaryLkr", 0))
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

    else:
        # ==========================================
        # SINGLE CURRENCY (LKR ONLY)
        # ==========================================
        title_single = f"SALARY SHEET (IN LKR) - {month.upper()}"
        sheet_rows.append((current_row_idx, [("A", 6, "inlineStr", title_single)]))
        current_row_idx += 1

        single_headers = [
            ("No", 7),
            ("Employee Name", 8),
            ("POSITION", 8),
            ("Basic Salary (LKR)", 9),
            ("Working Days", 7),
            ("Earned Base (LKR)", 9),
            ("EPF 8%", 9),
            ("EPF 12%", 9),
            ("ETF 3%", 9),
            ("APIT", 9),
            ("Other Deductions", 9),
            ("Net Remittance (LKR)", 9),
            ("BANK ACCOUNT NO", 7),
            ("TIN NO", 7),
            ("IDNO", 7),
            ("Date Joined", 7)
        ]
        row_cells = []
        for c_idx, (h_text, s_idx) in enumerate(single_headers):
            row_cells.append((col_letters[c_idx], s_idx, "inlineStr", h_text))
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        for e in employees:
            bank_str = f"{e.get('bankAccountNo','')}({e.get('bankCode','')})" if e.get('bankCode') else str(e.get('bankAccountNo',''))
            base_sal = e.get("lkrSalary") or e.get("baseSalaryLkr") or e.get("lkrGross", 0)
            row_cells = [
                ("A", 11, "num", e.get("no", "")),
                ("B", 10, "inlineStr", e.get("name", "")),
                ("C", 10, "inlineStr", e.get("position", "")),
                ("D", 12, "num", base_sal),
                ("E", 11, "inlineStr", e.get("workDays", "")),
                ("F", 12, "num", e.get("lkrGross", 0)),
                ("G", 12, "num", e.get("epf8Lkr", 0)),
                ("H", 12, "num", e.get("epf12Lkr", 0)),
                ("I", 12, "num", e.get("etf3Lkr", 0)),
                ("J", 12, "num", e.get("apit", 0)),
                ("K", 11, "inlineStr", ""),
                ("L", 14, "num", e.get("netSalaryLkr", 0)),
                ("M", 10, "inlineStr", bank_str),
                ("N", 11, "inlineStr", e.get("tinNo", "")),
                ("O", 11, "inlineStr", e.get("idNo", "")),
                ("P", 11, "inlineStr", e.get("dateJoined", ""))
            ]
            sheet_rows.append((current_row_idx, row_cells))
            current_row_idx += 1

        # Single currency totals row
        row_cells = [
            ("A", 15, "inlineStr", "TOTAL"),
            ("B", 15, "inlineStr", ""),
            ("C", 15, "inlineStr", ""),
            ("D", 16, "num", totals.get("sumLkrGross", 0)),
            ("E", 15, "inlineStr", ""),
            ("F", 16, "num", totals.get("sumLkrGross", 0)),
            ("G", 16, "num", totals.get("sumEpf8Lkr", 0)),
            ("H", 16, "num", totals.get("sumEpf12Lkr", 0)),
            ("I", 16, "num", totals.get("sumEtf3Lkr", 0)),
            ("J", 16, "num", totals.get("sumApitLkr", 0)),
            ("K", 15, "inlineStr", ""),
            ("L", 17, "num", totals.get("sumNetSalaryLkr", 0)),
            ("M", 15, "inlineStr", ""),
            ("N", 15, "inlineStr", ""),
            ("O", 15, "inlineStr", ""),
            ("P", 15, "inlineStr", "")
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        # Sign-off row
        checked_str = f"Checked by: {enriched_period.get('checkedBy','')}, {enriched_period.get('checkedTitle','Accountant')}"
        auth_str = f"Authorized by: {enriched_period.get('authorizedSignatory','')}, {enriched_period.get('authorizedCompany','')}"
        row_cells = [
            ("A", 18, "inlineStr", checked_str),
            ("F", 18, "inlineStr", auth_str)
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

    # Build XML string for sheet1.xml
    sheet_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '  <sheetViews>',
        '    <sheetView tabSelected="1" workbookViewId="0">',
        '      <selection activeCell="A1" sqref="A1"/>',
        '    </sheetView>',
        '  </sheetViews>',
        '  <sheetFormatPr defaultRowHeight="16"/>',
        '  <cols>',
        '    <col min="1" max="1" width="5" customWidth="1"/>',
        '    <col min="2" max="2" width="32" customWidth="1"/>',
        '    <col min="3" max="3" width="25" customWidth="1"/>',
        '    <col min="4" max="4" width="15" customWidth="1"/>',
        '    <col min="5" max="5" width="13" customWidth="1"/>',
        '    <col min="6" max="6" width="17" customWidth="1"/>',
        '    <col min="7" max="7" width="15" customWidth="1"/>',
        '    <col min="8" max="8" width="13" customWidth="1"/>',
        '    <col min="9" max="9" width="15" customWidth="1"/>',
        '    <col min="10" max="10" width="17" customWidth="1"/>',
        '    <col min="11" max="11" width="14" customWidth="1"/>',
        '    <col min="12" max="12" width="16" customWidth="1"/>',
        '    <col min="13" max="13" width="18" customWidth="1"/>',
        '    <col min="14" max="16" width="15" customWidth="1"/>',
        '  </cols>',
        '  <sheetData>'
    ]

    for r_idx, cells in sheet_rows:
        sheet_xml_lines.append(f'    <row r="{r_idx}">')
        for c_col, s_idx, c_type, val in cells:
            cell_ref = f"{c_col}{r_idx}"
            if c_type == "num":
                try:
                    num_val = float(val) if val != "" else 0
                    if num_val == int(num_val) and s_idx in (11, 12, 16):
                        sheet_xml_lines.append(f'      <c r="{cell_ref}" s="{s_idx}"><v>{int(num_val)}</v></c>')
                    else:
                        sheet_xml_lines.append(f'      <c r="{cell_ref}" s="{s_idx}"><v>{num_val:.2f}</v></c>')
                except (ValueError, TypeError):
                    escaped_str = escape_xml(val)
                    sheet_xml_lines.append(f'      <c r="{cell_ref}" s="{s_idx}" t="inlineStr"><is><t>{escaped_str}</t></is></c>')
            else:
                escaped_str = escape_xml(val)
                sheet_xml_lines.append(f'      <c r="{cell_ref}" s="{s_idx}" t="inlineStr"><is><t>{escaped_str}</t></is></c>')
        sheet_xml_lines.append('    </row>')

    sheet_xml_lines.append('  </sheetData>')
    sheet_xml_lines.append('</worksheet>')
    sheet_xml = '\n'.join(sheet_xml_lines)

    # Stylesheet with Calibri size 8 across ALL elements
    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
  </numFmts>
  <fonts count="4">
    <!-- Font 0: Normal Calibri 8 -->
    <font><sz val="8"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 1: Bold Calibri 8 -->
    <font><b/><sz val="8"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 2: Bold Calibri 8 (Corporate Blue) -->
    <font><b/><sz val="8"/><color rgb="FF1E3A8A"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 3: Italic Calibri 8 -->
    <font><i/><sz val="8"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="5">
    <!-- Required fills 0 and 1 -->
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <!-- Fill 2: Table Header Soft Gray #F2F2F2 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill>
    <!-- Fill 3: Section Title Soft Blue #D9E1F2 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill>
    <!-- Fill 4: Light Accent Green #E2EFDA -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/></patternFill></fill>
  </fills>
  <borders count="4">
    <!-- Border 0: None -->
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <!-- Border 1: Thin Gray border all around -->
    <border>
      <left style="thin"><color rgb="FFD4D4D8"/></left>
      <right style="thin"><color rgb="FFD4D4D8"/></right>
      <top style="thin"><color rgb="FFD4D4D8"/></top>
      <bottom style="thin"><color rgb="FFD4D4D8"/></bottom>
      <diagonal/>
    </border>
    <!-- Border 2: Accounting Totals (Top Thin, Bottom Double) -->
    <border>
      <left/><right/>
      <top style="thin"><color rgb="FF000000"/></top>
      <bottom style="double"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
    <!-- Border 3: Header border -->
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="thin"><color rgb="FF94A3B8"/></top>
      <bottom style="medium"><color rgb="FF475569"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="19">
    <!-- 0: Normal text left -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 1: Normal text center -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 2: Normal text right -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 3: Bold text left -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 4: Bold text center -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 5: Bold text right -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 6: Section Header Title (bold 8pt, bg #D9E1F2, left) -->
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 7: Table Header center (bold 8pt, bg #F2F2F2, border 3) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 8: Table Header left (bold 8pt, bg #F2F2F2, border 3) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <!-- 9: Table Header right (bold 8pt, bg #F2F2F2, border 3) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <!-- 10: Data cell text left (border 1) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 11: Data cell text center (border 1) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 12: Data cell integer right (border 1, numFmt #,##0) -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 13: Data cell float right (border 1, numFmt #,##0.00) -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 14: Data cell bold float right (border 1, numFmt #,##0.00, font 2 blue) -->
    <xf numFmtId="164" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 15: Totals row label (bold, border 2) -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 16: Totals row integer (bold, border 2, numFmt #,##0) -->
    <xf numFmtId="165" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 17: Totals row float (bold, border 2, numFmt #,##0.00) -->
    <xf numFmtId="164" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 18: Signoff row (calibri 8) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>"""

    # Assemble zip archive
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>""")

        z.writestr('_rels/.rels', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>""")

        z.writestr('docProps/app.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Spillburg Enterprise Portal</Application>
</Properties>""")

        z.writestr('docProps/core.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:creator>Spillburg Holdings</dc:creator>
  <cp:lastModifiedBy>Spillburg Holdings</cp:lastModifiedBy>
</cp:coreProperties>""")

        z.writestr('xl/_rels/workbook.xml.rels', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>""")

        z.writestr('xl/workbook.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Salary Sheet" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>""")

        z.writestr('xl/styles.xml', styles_xml)
        z.writestr('xl/worksheets/sheet1.xml', sheet_xml)

    return bio.getvalue()
