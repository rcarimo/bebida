import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { onDataChanged } from './db';

/**
 * Carrega dados quando o ecrã ganha foco e sempre que o banco muda
 * (registo novo, desfazer, sincronização que trouxe dados de outro telefone).
 */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    const result = await loaderRef.current();
    setData(result);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => onDataChanged(() => void reload()), [reload]);

  return { data, reload };
}
