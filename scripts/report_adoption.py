#!/usr/bin/env python3
"""Read-only GitHub adoption snapshot; no token values are written or logged."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='alsatianco/binturong')
    parser.add_argument('--token-file', type=Path, help='Optional credential file; otherwise GH_TOKEN/GITHUB_TOKEN')
    parser.add_argument('--output-dir', type=Path, default=Path('docs/adoption/snapshots'))
    args = parser.parse_args()
    token = args.token_file.read_text().strip() if args.token_file else os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'Binturong-adoption-report', 'X-GitHub-Api-Version': '2022-11-28'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    base = 'https://api.github.com/repos/' + args.repo

    def get(path):
        try:
            with urllib.request.urlopen(urllib.request.Request(base + path, headers=headers), timeout=30) as response:
                return {'status': 'available', 'data': json.load(response)}
        except urllib.error.HTTPError as error:
            return {'status': 'unavailable', 'http_status': error.code}
        except (urllib.error.URLError, TimeoutError):
            return {'status': 'unavailable', 'reason': 'network error or timeout'}

    now = datetime.now(timezone.utc)
    repo = get('')
    if repo['status'] != 'available':
        raise SystemExit('Repository metadata unavailable; HTTP ' + str(repo.get('http_status', 'unknown')))
    r = repo['data']
    releases = []
    release_status = 'available'
    page = 1
    while True:
        response = get(f'/releases?per_page=100&page={page}')
        if response['status'] != 'available':
            release_status = response
            break
        data = response['data']
        for release in data:
            releases.append({
                'tag': release['tag_name'], 'url': release['html_url'],
                'published_at': release['published_at'], 'prerelease': release['prerelease'],
                'assets': [{'id': a['id'], 'name': a['name'], 'size_bytes': a['size'],
                            'download_count': a['download_count']} for a in release['assets']],
            })
        if len(data) < 100:
            break
        page += 1
    report = {
        'schema_version': 1, 'captured_at_utc': now.isoformat(), 'repository': args.repo,
        'authenticated': bool(token),
        'repository_metrics': {'stars': r['stargazers_count'], 'forks': r['forks_count'],
                               'subscribers': r['subscribers_count'],
                               'open_issues_including_pull_requests': r['open_issues_count']},
        'release_status': release_status, 'releases': releases,
        'traffic': {name: get('/traffic/' + path) for name, path in {
            'views_14_days': 'views', 'clones_14_days': 'clones',
            'referrers_14_days': 'popular/referrers', 'paths_14_days': 'popular/paths'}.items()},
        'website_visits': {'status': 'not_measured', 'value': None},
        'installation_problems': {'status': 'manual_log', 'path': 'docs/adoption/feedback.csv'},
        'substantive_feedback': {'status': 'manual_log', 'path': 'docs/adoption/feedback.csv'},
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    path = args.output_dir / (now.strftime('%Y-%m-%dT%H%M%S%fZ') + '.json')
    with path.open('x') as output:
        json.dump(report, output, indent=2)
        output.write('\n')
    print(path)
    print('Stars:', r['stargazers_count'], 'Forks:', r['forks_count'])
    for name, value in report['traffic'].items():
        print(name + ':', value['status'], value.get('http_status', ''))
    if release_status != 'available':
        print('Release download snapshot is partial; retry when API access returns.')


if __name__ == '__main__':
    main()
