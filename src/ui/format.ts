export function formatMoney(amount: number): string {
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${Math.abs(amount).toLocaleString('en-US')}`;
}

export function formatSignedMoney(amount: number): string {
    if (amount > 0) {
        return `+${formatMoney(amount)}`;
    }
    if (amount < 0) {
        return formatMoney(amount);
    }
    return formatMoney(0);
}

export function formatTime(seconds: number): string {
    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
