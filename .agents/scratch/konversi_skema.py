import re
import os

def parse_sql(sql_path):
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    # Clean comments (but preserve newlines)
    sql_clean = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)

    # Find CREATE TABLE blocks
    # Format: CREATE TABLE [IF NOT EXISTS] name ( body );
    table_pattern = re.compile(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.*?)\)\s*;',
        re.DOTALL | re.IGNORECASE
    )

    tables = {}
    foreign_keys = []

    for match in table_pattern.finditer(sql_clean):
        table_name = match.group(1).lower()
        body = match.group(2)
        
        # Split body by commas, but handle nested parentheses (like CHECK constraints or DECIMAL(12,2))
        lines = []
        current_line = []
        depth = 0
        for char in body:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
            
            if char == ',' and depth == 0:
                lines.append(''.join(current_line).strip())
                current_line = []
            else:
                current_line.append(char)
        if current_line:
            lines.append(''.join(current_line).strip())

        columns = []
        for line in lines:
            line = re.sub(r'\s+', ' ', line).strip()
            if not line:
                continue
            
            # Check for table constraints (FOREIGN KEY, PRIMARY KEY, UNIQUE, etc.) at the bottom of CREATE TABLE
            if line.upper().startswith('CONSTRAINT'):
                # Handle inline constraints if needed
                continue
            if line.upper().startswith('PRIMARY KEY'):
                continue
            if line.upper().startswith('FOREIGN KEY'):
                # Extract table-level FK
                fk_match = re.search(r'FOREIGN\s+KEY\s*\((\w+)\)\s*REFERENCES\s*(\w+)\s*\((\w+)\)', line, re.IGNORECASE)
                if fk_match:
                    foreign_keys.append({
                        'from_table': table_name,
                        'from_col': fk_match.group(1).lower(),
                        'to_table': fk_match.group(2).lower(),
                        'to_col': fk_match.group(3).lower()
                    })
                continue
            if line.upper().startswith('UNIQUE') and '(' in line:
                continue
            if line.upper().startswith('CHECK') and '(' in line:
                continue

            # Parse columns
            parts = line.split(' ')
            if len(parts) < 2:
                continue
            
            col_name = parts[0].lower()
            col_type = parts[1].lower()

            # Handle type modifiers like decimal(12,2) or varchar(255)
            # Reconstruct the type if split
            if '(' in col_name:
                # Malformed line or constraint
                continue
            
            # Check for inline references
            ref_match = re.search(r'REFERENCES\s+(\w+)\s*\((\w+)\)', line, re.IGNORECASE)
            if ref_match:
                foreign_keys.append({
                    'from_table': table_name,
                    'from_col': col_name,
                    'to_table': ref_match.group(1).lower(),
                    'to_col': ref_match.group(2).lower()
                })

            is_pk = 'PRIMARY KEY' in line.upper()
            is_unique = 'UNIQUE' in line.upper()
            is_not_null = 'NOT NULL' in line.upper()

            columns.append({
                'name': col_name,
                'type': col_type,
                'is_pk': is_pk,
                'is_unique': is_unique,
                'is_not_null': is_not_null
            })
        
        tables[table_name] = columns

    return tables, foreign_keys

def generate_dbml(tables, foreign_keys):
    dbml = []
    dbml.append("// DBML (Database Markup Language) untuk Denanta TranSolution")
    dbml.append("// Paste ini ke https://dbdiagram.io untuk menghasilkan ERD interaktif yang sangat rapi\n")

    for table_name, cols in tables.items():
        dbml.append(f"Table {table_name} {{")
        for col in cols:
            opts = []
            if col['is_pk']:
                opts.append("pk")
            if col['is_unique']:
                opts.append("unique")
            if col['is_not_null']:
                opts.append("not null")
            
            opt_str = f" [{', '.join(opts)}]" if opts else ""
            dbml.append(f"  {col['name']} {col['type']}{opt_str}")
        dbml.append("}\n")

    dbml.append("// Relasi Antar Tabel (Foreign Keys)")
    for fk in foreign_keys:
        # Determine relation type: one-to-one for 1:1 references, otherwise many-to-one
        # E.g. orang_tua.id -> pengguna.id is 1:1 (both are PKs)
        is_one_to_one = False
        from_table_pk = next((c for c in tables.get(fk['from_table'], []) if c['name'] == fk['from_col'] and c['is_pk']), None)
        to_table_pk = next((c for c in tables.get(fk['to_table'], []) if c['name'] == fk['to_col'] and c['is_pk']), None)
        
        if from_table_pk and to_table_pk and fk['from_col'] == 'id':
            # One-to-one
            relation = "-"
        else:
            # Many-to-one
            relation = ">"
            
        dbml.append(f"Ref: {fk['from_table']}.{fk['from_col']} {relation} {fk['to_table']}.{fk['to_col']}")

    return '\n'.join(dbml)

def generate_mermaid(tables, foreign_keys):
    mermaid = []
    mermaid.append("erDiagram")
    
    for table_name, cols in tables.items():
        mermaid.append(f"    {table_name} {{")
        for col in cols:
            # Clean type for mermaid (no spaces or special chars)
            clean_type = re.sub(r'[^a-zA-Z0-9]', '', col['type'])
            pk_fk = ""
            if col['is_pk']:
                pk_fk = "PK"
            # check if it is FK
            is_fk = any(fk['from_table'] == table_name and fk['from_col'] == col['name'] for fk in foreign_keys)
            if is_fk:
                pk_fk += " FK" if pk_fk else "FK"
                
            mermaid.append(f"        {clean_type} {col['name']} {pk_fk}")
        mermaid.append("    }")

    mermaid.append("\n    %% Relasi Antar Tabel")
    for fk in foreign_keys:
        # Check if 1:1 or 1:N
        is_one_to_one = False
        if fk['from_col'] == 'id':
            is_one_to_one = True
            
        relation_symbol = "|o--||" if is_one_to_one else "}o--||"
        mermaid.append(f"    {fk['to_table']} {relation_symbol} {fk['from_table']} : \"fk_{fk['from_table']}_{fk['to_table']}\"")

    return '\n'.join(mermaid)

if __name__ == '__main__':
    sql_file = 'skema_database.sql'
    if os.path.exists(sql_file):
        tables, fks = parse_sql(sql_file)
        
        dbml_content = generate_dbml(tables, fks)
        os.makedirs('ERD', exist_ok=True)
        with open('ERD/skema_database.dbml', 'w', encoding='utf-8') as f:
            f.write(dbml_content)
        print("Generated ERD/skema_database.dbml")
        
        mermaid_content = generate_mermaid(tables, fks)
        with open('ERD/skema_database.mermaid', 'w', encoding='utf-8') as f:
            f.write(mermaid_content)
        print("Generated ERD/skema_database.mermaid")
    else:
        print("skema_database.sql not found")
