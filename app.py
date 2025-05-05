from flask import Flask, render_template, jsonify, request
import json
import os

app = Flask(__name__)

CONFIG_FILE = 'config.json'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/view')
def view():
    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
    return render_template('view.html', sources=list(config.keys()))

@app.route('/get_source/<source_name>')
def get_source(source_name):
    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
    return jsonify(config.get(source_name, {}))

@app.route('/save_source', methods=['POST'])
def save_source():
    data = request.json
    source_name = data.get('sourceName')
    source_config = data.get('config')

    if not source_name or not source_config:
        return jsonify({'error': 'Missing data'}), 400

    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)

    config[source_name] = source_config

    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)

    return jsonify({'success': True})

@app.route('/generate_config', methods=['POST'])
def generate_config():
    data = request.json
    config = {}

    source_name = data.get('sourceName')
    if source_name:
        config[source_name] = {}

        # Create basic config with required fields
        config[source_name]["type"] = "catalog"
        config[source_name]["url"] = data.get('urls', [])

        # Add selectors
        selectors = {
            "source": source_name,
            "news": data.get('newsSelector', ''),
            "news_link": data.get('newsLinkSelector', '')
        }

        # Add optional selectors
        optional_fields = ['title', 'published_date', 'abstract', 'content', 'author', 'attachments']
        for field in optional_fields:
            if data.get(f'selector_{field}'):
                selectors[field] = data.get(f'selector_{field}')

        config[source_name]["selectors"] = selectors

        # Add detail page selectors if present
        detail_fields = ['title', 'article_date', 'content', 'author', 'attachments']
        news_selector = {}
        for field in detail_fields:
            if data.get(f'news_selector_{field}'):
                news_selector[field] = data.get(f'news_selector_{field}')

        if news_selector:
            config[source_name]["news_selector"] = news_selector

        # Add rendering option
        if data.get('render'):
            config[source_name]['render'] = True

        # Add proxy settings
        if data.get('premium_proxy'):
            config[source_name]['premium_proxy'] = True
        elif data.get('stealth_proxy'):
            config[source_name]['stealth_proxy'] = True

        # Add wait settings
        if data.get('wait'):
            config[source_name]['wait'] = int(data.get('wait'))

        if data.get('wait_browser'):
            config[source_name]['wait_browser'] = data.get('wait_browser')

        if data.get('wait_for'):
            config[source_name]['wait_for'] = data.get('wait_for')

        # Add headers and cookies if present
        if 'headers' in data and data['headers']:
            try:
                headers = json.loads(data['headers']) if isinstance(data['headers'], str) else data['headers']
                config[source_name]['headers'] = headers
            except json.JSONDecodeError:
                pass

        if 'cookies' in data and data['cookies']:
            try:
                cookies = json.loads(data['cookies']) if isinstance(data['cookies'], str) else data['cookies']
                config[source_name]['cookies'] = cookies
            except json.JSONDecodeError:
                pass

    return jsonify(config)

if __name__ == '__main__':
    app.run(debug=True)
