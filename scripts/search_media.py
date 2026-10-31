import urllib.request
import json
import sys

CATEGORIES = {
    'van_hoa_doc': [
        'library interior reading',
        'reading book cafe',
        'books on wooden table',
        'public library hall'
    ],
    'xuat_ban_so': [
        'reading tablet ebook',
        'reading on ipad',
        'reading smartphone book',
        'digital workspace tablet'
    ],
    'hoi_nghi': [
        'conference hall auditorium',
        'academic conference seminar',
        'symposium panel discussion',
        'lecture hall audience'
    ],
    'trien_lam': [
        'book fair exhibition',
        'book festival market',
        'book display exhibition',
        'art gallery book display'
    ],
    'ly_luan': [
        'antique library archive',
        'historical leather bound books',
        'old archive books',
        'rare books library'
    ]
}

def search(query, limit=5):
    encoded = urllib.parse.quote(query)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={encoded}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1400&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'AntigravityDev/1.0 (contact@solutionai.vn)'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            pages = data.get('query', {}).get('pages', {})
            results = []
            for pid, page in pages.items():
                title = page.get('title', '')
                info = page.get('imageinfo', [{}])[0]
                mime = info.get('mime', '')
                if 'jpeg' in mime or 'png' in mime or 'jpg' in mime:
                    results.append({
                        'title': title,
                        'url': info.get('url'),
                        'thumburl': info.get('thumburl', info.get('url')),
                        'width': info.get('width', 0),
                        'height': info.get('height', 0),
                        'thumbwidth': info.get('thumbwidth', 0),
                        'thumbheight': info.get('thumbheight', 0),
                    })
            return results[:limit]
    except Exception as e:
        print(f"Error querying {query}: {e}")
        return []

if __name__ == '__main__':
    catalog = {}
    for cat, queries in CATEGORIES.items():
        print(f"=== Category: {cat} ===")
        catalog[cat] = []
        for q in queries:
            res = search(q, 3)
            for item in res:
                print(f"  [{cat}] {item['title']} ({item['width']}x{item['height']})")
                print(f"     -> {item['thumburl']}")
                catalog[cat].append(item)
    with open('/tmp/media_catalog.json', 'w') as f:
        json.dump(catalog, f, indent=2)
    print("Saved catalog to /tmp/media_catalog.json")
