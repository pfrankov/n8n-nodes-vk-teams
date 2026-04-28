type KeyboardButtonInput = {
	text?: unknown;
	buttonType?: unknown;
	callbackData?: unknown;
	url?: unknown;
	style?: unknown;
};

type KeyboardCollection = {
	rows?: Array<{
		row?: {
			buttons?: KeyboardButtonInput[];
		};
	}>;
};

type KeyboardButton = {
	text: string;
	callbackData?: string;
	url?: string;
	style?: 'base' | 'primary' | 'attention';
};

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

function buildKeyboardButton(button: KeyboardButtonInput, rowIndex: number, buttonIndex: number): KeyboardButton {
	const label = `Keyboard button ${rowIndex + 1}:${buttonIndex + 1}`;
	const text = requireNonEmptyString(button.text, `${label} text`);
	const buttonType = button.buttonType === 'url' ? 'url' : 'callbackData';
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

export function buildInlineKeyboardMarkup(input: unknown): KeyboardButton[][] | undefined {
	if (input === undefined || input === null || typeof input !== 'object' || Array.isArray(input)) {
		return undefined;
	}

	const rows = (input as KeyboardCollection).rows ?? [];
	const keyboard = rows
		.map((row, rowIndex) => {
			const buttons = row.row?.buttons ?? [];
			return buttons.map((button, buttonIndex) => buildKeyboardButton(button, rowIndex, buttonIndex));
		})
		.filter((row) => row.length > 0);

	return keyboard.length > 0 ? keyboard : undefined;
}
