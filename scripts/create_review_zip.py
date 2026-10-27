import os
import zipfile
import sys

def create_zip(zip_name):
    print(f"Creating {zip_name}...")
    exclude_dirs = {'.git', 'node_modules', '.vite', 'dist', '__pycache__'}
    exclude_extensions = {'.zip'}

    count = 0
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk('.'):
            # Prune excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                if any(file.endswith(ext) for ext in exclude_extensions):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, '.')
                zf.write(file_path, rel_path)
                count += 1
                
    size_mb = os.path.getsize(zip_name) / (1024 * 1024)
    print(f"Successfully created {zip_name} ({count} files, {size_mb:.2f} MB)")

    # Verify zip integrity
    print(f"Verifying {zip_name} integrity...")
    with zipfile.ZipFile(zip_name, 'r') as zf:
        bad_file = zf.testzip()
        if bad_file:
            print(f"Corrupted file in zip: {bad_file}")
            sys.exit(1)
        namelist = zf.namelist()
        print(f"Zip verified: {len(namelist)} items in archive.")
        
        # Check critical items
        critical_items = [
            'package.json',
            'tsconfig.json',
            'vite.config.ts',
            'AUDIT_RESULTS.md',
            'REVIEW_README.md',
            'MANIFEST.md',
            'src/main.tsx',
            'public/sw.js',
            'docs/screenshots/01_library_view.png',
            'docs/screenshots/offline_reload_verified.png',
            'logs/unit_tests.log',
            'logs/offline_reload.log'
        ]
        for item in critical_items:
            norm_item = item.replace('/', os.sep)
            if item in namelist or norm_item in namelist:
                print(f"  [x] {item}")
            else:
                print(f"  [!] Missing {item}")
                sys.exit(1)

if __name__ == '__main__':
    create_zip('DimmingLab_REVIEW_PACKAGE.zip')
