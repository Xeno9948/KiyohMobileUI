import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'nl', 'de', 'fr', 'es'];
export const defaultLocale = 'en';

export default getRequestConfig(async () => {
    const cookieStore = cookies();
    const locale = cookieStore.get('NEXT_LOCALE')?.value || defaultLocale;

    return {
        locale,
        messages: (await import(`./messages/${locale}.json`)).default
    };
});
