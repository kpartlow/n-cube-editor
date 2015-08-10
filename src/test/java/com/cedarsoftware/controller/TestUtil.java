package com.cedarsoftware.controller;

import org.junit.Test;

import java.util.SortedMap;
import java.util.TreeMap;

import static org.junit.Assert.assertTrue;

public class TestUtil
{
    @Test
    public void testStartsWith()
    {
        SortedMap<String, String> myMap = new TreeMap<>();

        for (int i=0; i < 1000000; i++)
        {
            myMap.put(String.valueOf(i), "");
        }

        String key = "768123";
        long start = System.nanoTime();
        SortedMap<String, String> tailMap = myMap.tailMap(key);
        assertTrue(tailMap.firstKey().startsWith(key));
        long end = System.nanoTime();

        System.out.println("(end - start) = " + (end - start));
    }
}
