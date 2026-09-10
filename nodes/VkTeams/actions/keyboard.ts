type KeyboardButton = {
	text: string;
	callbackData?: string;
	url?: string;
	style?: 'base' | 'primary' | 'attention';
};

function requireObject(value: unknown, name: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${name} must be an object`);
	}

	return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${name} is required`);
	}

	return value;
}

function normalizeButtonStyle(value: unknown): KeyboardButton['style'] {
	if (value === undefined || value === null || value === '') {
		return 'base';
	}

	if (value !== 'base' && value !== 'primary' && value !== 'attention') {
		throw new Error('Keyboard button style must be base, primary, or attention');
	}

	return value;
}

function getButtonType(button: Record<string, unknown>, label: string): 'url' | 'callbackData' {
	if (button.buttonType !== undefined) {
		if (button.buttonType !== 'url' && button.buttonType !== 'callbackData') {
			throw new Error(`${label} type must be callbackData or url`);
		}
		return button.buttonType;
	}

	if (button.url !== undefined && button.url !== '') {
		if (button.callbackData !== undefined && button.callbackData !== '') {
			throw new Error(`${label} must have callback data or URL, not both`);
		}
		return 'url';
	}

	return 'callbackData';
}

function buildKeyboardButton(input: unknown, rowIndex: number, buttonIndex: number): KeyboardButton {
	const label = `Keyboard button ${rowIndex + 1}:${buttonIndex + 1}`;
	const button = requireObject(input, label);
	const text = requireNonEmptyString(button.text, `${label} text`);
	const buttonType = getButtonType(button, label);
	const style = normalizeButtonStyle(button.style);

	if (buttonType === 'url') {
		return {
			text,
			url: requireNonEmptyString(button.url, `${label} URL`),
			style,
		};
	}

	return {
		text,
		callbackData: requireNonEmptyString(button.callbackData, `${label} callback data`),
		style,
	};
}

function parseKeyboardInput(input: unknown): unknown {
	if (typeof input !== 'string') {
		return input;
	}
	if (input.trim() === '') {
		return undefined;
	}

	try {
		return JSON.parse(input) as unknown;
	} catch {
		throw new Error('Inline keyboard must be valid JSON');
	}
}

function getKeyboardRows(input: unknown): unknown[] {
	const value = parseKeyboardInput(input);
	if (value === undefined || value === null) {
		return [];
	}
	if (Array.isArray(value)) {
		return value;
	}

	const collection = requireObject(value, 'Inline keyboard');
	if (Object.keys(collection).length === 0) {
		return [];
	}
	if (!Array.isArray(collection.rows)) {
		throw new Error('Inline keyboard rows must be an array');
	}

	return collection.rows;
}

function getRowButtons(input: unknown, rowIndex: number): unknown[] {
	if (Array.isArray(input)) {
		return input;
	}

	const label = `Keyboard row ${rowIndex + 1}`;
	const row = requireObject(input, label);
	if (Object.keys(row).length === 0) {
		return [];
	}
	if (row.row === undefined) {
		throw new Error(`${label} must contain row.buttons`);
	}
	const buttons = requireObject(row.row, label).buttons ?? [];
	if (!Array.isArray(buttons)) {
		throw new Error(`${label} buttons must be an array`);
	}

	return buttons;
}

export function buildInlineKeyboardMarkup(input: unknown): KeyboardButton[][] | undefined {
	const keyboard = getKeyboardRows(input)
		.map((row, rowIndex) =>
			getRowButtons(row, rowIndex).map((button, buttonIndex) =>
				buildKeyboardButton(button, rowIndex, buttonIndex),
			),
		)
		.filter((row) => row.length > 0);

	return keyboard.length > 0 ? keyboard : undefined;
}
