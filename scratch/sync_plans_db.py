import zipfile
import xml.etree.ElementTree as ET
import psycopg2

DB_PARAMS = {
    "dbname": "dailylover",
    "user": "postgres",
    "password": "your_secure_postgres_password",
    "host": "localhost",
    "port": "5432"
}

file_path = r"/tmp/Daily Lover MATCHMAKING.xlsx"

def clean_str(val):
    return str(val).strip() if val is not None else ""

def sync_plans():
    conn = psycopg2.connect(**DB_PARAMS)
    conn.autocommit = True
    cur = conn.cursor()
    
    with zipfile.ZipFile(file_path, 'r') as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in ss_tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                shared_strings.append("".join([t.text for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text]))

        wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
        sheet_file = ''
        for idx, sheet in enumerate(wb_tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')):
            if sheet.attrib['name'] == 'Clients plans':
                sheet_file = f"xl/worksheets/sheet{idx+1}.xml"
                break
                
        ws_tree = ET.fromstring(z.read(sheet_file))
        rows = ws_tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        
        plans_config = [
            ('VIP 195k', 0, 1),
            ('Premium 150k', 2, 3),
            ('Estándar Plus 98k', 4, 5),
            ('Estándar 65k (2 citas)', 6, 7),
            ('Estándar 65k (1 cita)', 8, 9),
            ('Básico 40k', 10, 11)
        ]
        
        updated_count = 0
        for r in rows[1:]:
            row_vals = []
            for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                t = c.attrib.get('t')
                v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                val = ''
                if v is not None and v.text is not None:
                    val = v.text
                    if t == 's' and int(val) < len(shared_strings):
                        val = shared_strings[int(val)]
                row_vals.append(val)
                
            for plan_name, name_idx, email_idx in plans_config:
                name_val = clean_str(row_vals[name_idx]) if name_idx < len(row_vals) else ''
                email_val = clean_str(row_vals[email_idx]) if email_idx < len(row_vals) else ''
                
                if name_val or email_val:
                    cur.execute("""
                        UPDATE profiles p
                        SET plan_tier = %s
                        FROM users u
                        WHERE p.user_id = u.id
                          AND (
                            (%s != '' AND lower(trim(u.email)) = lower(trim(%s)))
                            OR (%s != '' AND unaccent(lower(trim(u.name))) = unaccent(lower(trim(%s))))
                          );
                    """, (plan_name, email_val, email_val, name_val, name_val))
                    updated_count += cur.rowcount

        print(f"Successfully matched and assigned {updated_count} plan_tier records in DB!")

if __name__ == "__main__":
    sync_plans()
