module.exports = [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^(req|res|next|error|err|_)',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
]
