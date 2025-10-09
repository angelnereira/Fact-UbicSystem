
"use client";

import * as React from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase";

export type Configuration = {
  id: string;
  companyName: string;
  companyRuc: string;
  webhookIdentifier: string;
  demoUser?: string;
  demoPassword?: string;
  prodUser?: string;
  prodPassword?: string;
};

export function useConfigurations() {
    const firestore = useFirestore();
    const [configs, setConfigs] = React.useState<Configuration[]>([]);
    const [loading, setLoading] = React.useState(true);

    const configsQuery = useMemoFirebase(
        () => firestore ? collection(firestore, "configurations") : null,
        [firestore]
    );

    React.useEffect(() => {
        if (!configsQuery) {
            setLoading(false);
            return;
        };
        const unsubscribe = onSnapshot(configsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Configuration));
            setConfigs(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching configurations:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [configsQuery]);
    
    return { configs, loading };
}
