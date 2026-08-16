import re
import os

def main():
    sql_file = 'skema_database.sql'
    if not os.path.exists(sql_file):
        print("skema_database.sql not found")
        return

    with open(sql_file, 'r', encoding='utf-8') as f:
        sql = f.read()

    # Clean comments
    sql_clean = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)

    # Find CREATE TABLE blocks
    table_pattern = re.compile(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.*?)\)\s*;',
        re.DOTALL | re.IGNORECASE
    )

    tables = {}
    foreign_keys = []

    for match in table_pattern.finditer(sql_clean):
        table_name = match.group(1).lower()
        body = match.group(2)
        
        # Split body by commas, but handle nested parentheses
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
            
            if any(line.upper().startswith(x) for x in ['CONSTRAINT', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK']):
                continue

            parts = line.split(' ')
            if len(parts) < 2:
                continue
            
            col_name = parts[0].lower()
            col_type = parts[1].lower()

            ref_match = re.search(r'REFERENCES\s+(\w+)\s*\((\w+)\)', line, re.IGNORECASE)
            if ref_match:
                foreign_keys.append({
                    'from_table': table_name,
                    'from_col': col_name,
                    'to_table': ref_match.group(1).lower(),
                    'to_col': ref_match.group(2).lower()
                })

            columns.append({
                'name': col_name,
                'type': col_type
            })
        
        tables[table_name] = columns

    # Generate Mermaid classDiagram
    mermaid = ["classDiagram"]
    for table_name, cols in tables.items():
        class_name = ''.join(word.capitalize() for word in table_name.split('_'))
        mermaid.append(f"    class {class_name} {{")
        for col in cols:
            # Clean type for mermaid
            clean_type = re.sub(r'[^a-zA-Z0-9(),.]', '', col['type'])
            mermaid.append(f"        +{clean_type} {col['name']}")
        mermaid.append("    }")

    mermaid.append("\n    %% Relationships")
    for fk in foreign_keys:
        from_class = ''.join(word.capitalize() for word in fk['from_table'].split('_'))
        to_class = ''.join(word.capitalize() for word in fk['to_table'].split('_'))
        
        # 1:1 for extensions like supir/orang_tua, otherwise 1:N
        cardinality = '"1" -- "1"' if fk['from_col'] == 'id' else '"1" -- "*"'
        mermaid.append(f"    {to_class} {cardinality} {from_class} : \"{fk['from_col']}\"")

    os.makedirs('ERD', exist_ok=True)
    with open('ERD/skema_database_class_diagram.mermaid', 'w', encoding='utf-8') as f:
        f.write('\n'.join(mermaid))
    print("Generated ERD/skema_database_class_diagram.mermaid")

if __name__ == '__main__':
    main()
